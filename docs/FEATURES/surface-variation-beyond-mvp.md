# Surface variation — what shipped as MVP, and what was deliberately left

**Systems touched:** worldengine, planet-lod-lab, rendering

> **Status:** four MVPs shipped and pushed 2026-07-30 (`eddec1f`, `1d5af29`, `49659d0`, `d600f8d`,
> `c7d0daa`). This file is the **deferred-work register** for them. It exists because the work was
> deliberately scoped to MVP under a directive to get the new procgen/rendering pipeline into the
> game quickly — so each cut is recorded here rather than lost in a commit message.
>
> **Read this before elaborating any of these systems.** Every entry states what exists now, what was
> cut, *why*, and what picking it up would actually involve. Nothing here is a bug unless it says so.

## What shipped

Ground colour used to be one hard-coded constant — `uWeatheredColor = (0.46, 0.40, 0.34)`, assigned
nowhere, shared by all 18 presets and by every point on every planet. Four MVPs replaced it:

| | what it does | key file |
|---|---|---|
| **A — archetype colour** | ground albedo derived from composition, oxidation, space weathering, carbon, melt | `src/worldengine/base/surfaceMaterial.js` |
| **B — terrain palette** | one colour → three endmembers (fresh / weathered / sediment), selected per pixel by slope + elevation | same + lab Stage 6 |
| **C — seed draw** | condition scalars drawn per macro seed, so two Rocky worlds differ in physics not just noise | `driver-presets.js` |
| **D — province colour** | `carrier.province` (craton/orogen/basin) baked to a cube and driving the palette | `planet-lod-tectonic.js` |
| **E — biosphere** | condition-derived photosynthetic ground cover | `surfaceMaterial.js` |

The architecture to preserve: **the body's condition picks a palette; local geology picks where in it
each pixel sits; the seed varies the condition.** Anything added here should fit that shape.

---

## Deferred — ranked by value

### 1. Atmosphere optics — SHIPPED 2026-07-30. Retention itself is CUT, with a reason.

**Shipped:** `src/worldengine/base/atmosphereOptics.js` (pure, imports nothing, same leaf discipline
as `surfaceMaterial.js`) now derives the limb and terminator hue from condition scalars.
`LIMB_COLOR_BY_PRESET` and `TERM_COLOR_BY_PRESET` are **deleted** — the last name-keyed lookups in
the colour path are gone. Calibration: `tools/atmosphere-optics-calibrate.mjs`.

What used to be eleven hand-written rows is now four physical terms: Rayleigh scattering in a clear
column (the Earth-blue line), organic haze on a cold volatile-rich world (Titan orange), a hot thick
sulfurous shroud (Venus cream), and a temperature ramp down a retained hydrogen deck (ice-giant blue
→ Jovian tan → hot-Jupiter red). The inverted BLUE Martian sunset falls out of the thin-column
forward-scatter term instead of being written down as a special case. Worst single channel vs the
authored tables: 0.07 limb, 0.11 terminator; four presets exact.

The `type`-string trap named in the 07-30 handoff was avoided rather than adapted around: nothing
imports `computeAtmosphere()`. The one piece of real escape physics needed is the Jeans parameter,
and `lambda = m·v_esc²/(2kT_exo)` with `v_esc² = 2gR` needs only `surfaceGravity` and `radiusEarth`,
both already on the condition vector. That derived scalar replaces the
`atmosphere.composition === 'h2-he'` string test in the optics path.

**⛔ CUT, and this one will not yield to more effort: deriving `retained` / `pressure` from scratch.**
A condition-pure retention law **cannot reproduce the Titan/Europa split.** Measured: Titan reads a
*weaker* Jeans hold than Europa (λ_N2 39 vs 78) and lower gravity, yet Titan is the one with 1.5 bar
of air and Europa is the airless one. The fact that separates them — Titan accreted an ammonia
inventory that photolysed to N₂, Europa never had a nitrogen source — is **not carried by any scalar
on the condition vector**, and no rearrangement of the existing scalars recovers it. The same holds
for Mars (λ_N2 59, retains fine by Jeans, actually has 0.01 bar because it lost its field).

Picking this up therefore means *adding a condition scalar* (a volatile-species mix, not just
`volatileFraction`), not writing a better law. Until then `retained`/`pressure` stay preset DATA —
they are numbers on the condition vector like density and T_eq, not labels, and `surfaceMaterial.js`
+ `bombardment.js` already read `atmosphere.pressure` as a legitimate condition scalar.

**Blast radius if someone tries anyway:** `atmosphere.composition` is load-bearing beyond colour —
`e1Regime.js:67` terminates the regime on `'h2-he'`, and `bombardment.js` / `surfaceMaterial.js` gate
on `pressure`. Deriving those moves E1 regimes and crater retention on presets Max has already UAT'd.

**⚠ The change is currently INVISIBLE in the default dressing.** `limbEnabled` is false by default
(F34 is legacy, "slated for replacement"), and Max **disabled F35 terminator outright on 2026-07-16**
(`docs/WORKSTREAMS/planet-lod-lab-ux-2026-07-15/GUI-INVENTORY.md`: "doesn't work, and day/night
shading belongs to the main game's lighting engine"). This increment makes the hue *correct and
derived*; it does not put it on screen. Verified by enabling `state.limbEnabled` manually. **If the
atmosphere is meant to be visible in the game, that is a separate decision about F34/F35's future,
and it is Max's — do not silently re-enable them.**

**Method note worth keeping:** the first haze gate was written at 200 K with a 120 K ramp, so haze
began appearing below 320 K. It passed calibration against the canonical presets and then turned a
temperate ocean world tan at macro seed 1, because `drawPresetConditions` draws T_eq (Ocean 295 →
267 K) and the calibration was reading RAW presets while the render reads the DRAWN condition.
`tools/atmosphere-optics-calibrate.mjs` now sweeps 24 seeds per preset and reports the widest
excursion, so this class of error is catchable headlessly. **A law that is right at the canonical
body and wrong two seeds over is not right.**

### 2. The two dark surface-material channels
`deriveSurfaceMaterial(cond, schedule)` returns `{ iceness, crystallizationPotential,
regolithRoughness }`. Only `iceness` is wired to the render. The other two are computed for every
world on every dispatch path and drive nothing.

- `regolithRoughness` → airless worlds should read dusty/soft rather than glassy.
- `crystallizationPotential` → the Crystal/Carbon facet response. Note the recorded adjudication in
  `surfaceMaterial.js`: the condition-derived ranking **inverts** the old boolean (Crystal derives
  BELOW Moon/Frozen because it is the most-impacted airless world), and that was deliberately left
  for Max rather than built around.

### 3. Vegetation realism
Cover is currently modulated only by slope, elevation and basin province weight.

- **No latitude/climate zoning.** A real biosphere bands by insolation; this one doesn't. The frost
  machinery already computes a usable cold factor (`frostBandCoord`).
- **No patchiness.** Cover is smooth wherever terrain allows it, so it reads as a wash rather than as
  forests. An FBM patch mask (F46's coverage-threshold idiom is the exemplar) would fix it cheaply.
- **Pigment is fixed green.** Real photosynthetic pigment tracks the host star's spectrum — an
  M-dwarf world plausibly running darker or IR-shunted. `starMassEarth` **is** on the condition
  vector, so this is derivable. Cut because the mapping needs calibration and an uncalibrated guess
  would look arbitrary while claiming to be physical.
- **No biome differentiation.** One pigment for all vegetated ground; no desert/grassland/forest split.

### 4. Sediment is inert
`carrier.sediment` exists as a host channel but is `fill(0)` — V2-8 deposition never runs. The basin
endmember is therefore selected by *province class*, not by actual deposited thickness. Wiring V2-8
would make basin colour track real sediment depth.

### 5. Display-transfer calibration
`ALBEDO_TONE_K = 4.176` (a Reinhard soft-clip on luminance, solved so Rocky reproduces the legacy
tone). Consequences, both acceptable-for-MVP and both tunable:
- **Darks compress.** Carbon reads mid-grey rather than near-black — physical ratio to Earthlike is
  0.43, displayed 0.56.
- **Moon reads slightly dark** — 0.084 vs an observed ~0.12.

The deeper item: this transfer exists **because the renderer is not physically exposed**. If the
lighting is ever put on a physical footing, the transfer should shrink or disappear, not be retuned.

### 6. Gas giants derive a ground colour nothing consumes
The colour law runs for all 18 presets, but the four giants have no solid surface and their look
comes from the band/storm path. Harmless, but it means the law is silently meaningless on 4 of 18.
Either gate it on composition class or make the giant path consume it as a deck tone.

### 7. Per-seed variation saturates on two presets
Measured over 24 seeds: 5 of 7 drawn presets vary substantially (Rocky ground luminance 61% of mean,
Ocean 59%, Eyeball 77%, Frozen iceness 174%, Crystal 243%). **Lava (7%) and Carbon (30%) barely
move** — correct physics, since the melt and carbide terms saturate and swamp everything upstream,
but if those worlds need variety it has to come from a different axis (relief, crater population,
thermal state) rather than from the colour law.

### 8. Named bodies never vary
`NAMED_BODY` (Mars, Titan, Europa, Venus, Magma, Hot Jupiter, Moon/Mercury) locks conditions to
canonical — Mars should always look like Mars. Correct as a fixture rule, but it means **7 of 18
presets show no seed variation at all**. If the game wants "a Mars-like world" as distinct from "the
Mars fixture", that needs a separate archetype entry, not a change to the lock.

---

## Notes for the game port

**STATUS 2026-07-30 (updated): SLICES 1 AND 2 OF THE PORT ARE IN THE GAME AND RENDERING.** Rocky,
terrestrial, ice and lava land colour is now condition-derived in `src/objects/Planet.js`. Blockers B
and the density unit bug are fixed at the seam; blocker A is resolved by wiring the LAND PATH ONLY;
blocker C is **WITHDRAWN** — it was my own measurement error, see below.

### ⛔⛔ SLICE 2 FOUND TWO DEFECTS THAT WERE ALREADY LIVE IN SLICE 1. Read this before trusting any
### measurement taken before 2026-07-30 evening.

Both were found by the same habit that found the first two: **measure the law across the whole
population before wiring it.** Neither is cosmetic, and neither was visible from the code.

**1. `atmosphere.pressure` was `undefined` — so EVERY BODY IN THE GAME reached the engine as airless.**

The two sides nest the field at different depths and, once again, the names do not warn you:

    engine / lab  atmosphere = { color, retained, pressure, composition }              <- FLAT
    game          atmosphere = { color, strength, physics: { retained, pressure, … } } <- WRAPPED

`PlanetGenerator` computes `atmoPhysics = computeAtmosphere(...)` and then wraps it in a VISUAL object
for the renderer. The seam passed that wrapper straight through, so `cond.atmosphere.pressure` was
`undefined` and every consumer's `?? 0` fallback hardened it into a zero. Measured across 330 swept
bodies (11 orbits x 6 metallicities x 5 types): **pressure 0.000 .. 0.000 bar, including a 90-bar
Venus and a 1.25-bar Earthlike.** What that silently did:

    erosionOf            -> 0 everywhere     (its gate is smoothstep(0, 0.5, P))
    airlessnessOf        -> 1 everywhere     => full space weathering on every world in the game
    biosphereOf          -> 0 everywhere     (its air gate never opens)
    surfaceTemperatureOf -> a NO-OP          => blocker B's greenhouse fix was installed but had
                                               NEVER ONCE FIRED on real game data (T_surf == T_eq to
                                               three decimals, all 330 bodies)

So the palette slice 1 shipped was derived from a body the engine believed was airless. Fixed with
`atmosphereFromPlanet()` in `conditionFromPlanet.js`; a null atmosphere stays null and an already-flat
one passes through untouched, so lab presets and hand-authored fixtures are unaffected.

**2. The game's bulk-density law used the WRONG MIXING RULE, so the generator contained no icy bodies
at all.** `deriveComposition` had `density = 3500 + iron*5000 - volatileFraction*2000`. Densities do
not mix by mass-weighted average — VOLUMES add, so bulk density is the harmonic mean weighted by mass
fraction, `1/rho = f_ice/rho_ice + (1-f_ice)/rho_rock`. Ice is ~5x less dense than rock, so 6% ice BY
MASS is already ~25% of the body BY VOLUME, and the linear form cannot express that. Brute-forced over
the ENTIRE input domain (metallicity -1..0.6, orbit 0.05..40 AU, every rng draw) its minimum output was
**2.86 g/cc**; over a realistic population it never fell below **3.5 g/cc**. Real icy bodies sit at
1.6-2.0 (Enceladus 1.61, Pluto 1.85, Titan 1.88, Ganymede 1.94). A body 43% ice by mass came out
denser than the Moon. Fixed to the volumetric mixture; dry inner bodies move -3%, which is the point.

> ⚠⚠ **CORRECTION TO THE 07-30 HANDOFF, which said `icenessOf()` "now works on game bodies".** It does
> not, and did not, on GENERATED bodies. That claim was verified on a HAND-CONSTRUCTED body
> (volatileFraction 0.5, density 2.0 g/cc, 110 K). The kg/m^3 -> g/cc unit fix was real and necessary,
> but it only removed a 1000x error on top of a density that could never get low enough anyway.
> Measured after the unit fix and before the mixing-rule fix: **iceness 0.000 on all 330 bodies.**
> After the mixing-rule fix: **0.000 .. 0.986, with 12/66 outer bodies reading icy.** Lesson, and it is
> a new one for this lane: **a gate verified on a synthetic fixture is not a gate verified on the
> population.** The fixture proves the law runs; only the population proves the law fires.

Blast radius of the density change is small and was checked before making it: `composition.density` is
read in exactly two places outside `PhysicsEngine.js` — the surfaced `planetDensity` HUD field and the
engine seam. `estimateMassEarth` is a pure mass-radius relation, so mass, gravity, escape velocity and
atmosphere retention are all untouched. The `l0-baseline.json` fixture drifted on `composition.density`
and NOTHING ELSE (23 keys x 10 bodies checked), which is the fixture's sanctioned regen case.

> ⚠ **DO NOT run `regen-l0-baseline.mjs` for this.** It re-bakes EVERY key it finds, which widened
> `BASELINE_KEYS` from 23 to 33 and froze this session's ADDITIVE keys (`landPalette`, `iceness`,
> `iceColor`, `lavaGlowColor`, `lavaCrustColor`) as regression baselines — the one thing that file's own
> header tells you not to do, and it trips the `toHaveLength(23)` guard. Patch the single drifted value
> instead.

### ✅ Slice 2 — the ice and lava land paths

- **Ice merged INTO the rocky branch, deleting a type test.** `planetType == 0 || planetType == 2` now
  share one condition-derived path: the bedrock ramp, then `mix(ground, uIceColor, uIcenessMix)` where
  `uIcenessMix = icenessOf(cond)` — the same construction as the lab's Stage-6 mix. Verified live: a
  body LABELLED 'ice' at 0.1 AU (962 K) renders as hot bare rock and does not respond to the ice dial
  at all, while a body labelled 'rocky' at 9 AU renders icy. The label is not what decides.
- **Lava cracks are blackbody, sampled TWICE.** `uLavaGlow` = `emissiveBlackbody(meltTemperatureOf(cond))`
  at the liquidus, `uLavaCrust` = the same curve at the chilled skin (`MELT_CRUST_FRACTION` 0.62). This
  replaces a 15-entry hand-picked table that offered violet, magenta, cyan and green "lava".
  New engine laws: `meltTemperatureOf` + `crustTemperatureOf` in `surfaceMaterial.js`. The melt
  temperature is the LIQUIDUS, not the ambient — Io's surface is 130 K while its lavas run 1600 K, so a
  glow keyed on T_eq would render every cool-orbit volcanic world's cracks black.
- **Lava cracks are now SELF-LUMINOUS** (an added emissive term next to the existing carbon-glint
  precedent), so they survive into the night side. Deriving a colour from a melt temperature and then
  only showing it in sunlight would be incoherent. ⚠ This is a visible change Max has not UAT'd.

> ⭐ **MEASUREMENT THAT CHANGED THE DESIGN — the "port reduces variety" trap, caught a second time.**
> Across 66 swept bodies of type 'lava' the melt temperature spans only **1538-1669 K**, which the
> blackbody ramp turns into **seven indistinguishable oranges**. Shipping the hot colour alone would
> have replaced 15 varied (if fictional) lava tones with ONE flat orange for every volcanic world —
> the exact shape of withdrawn blocker C. The fix was NOT to invent between-world spread the physics
> does not have: the real range in a lava field is WITHIN one body (open vent at the liquidus, flow
> twenty metres away skinned over and hundreds of kelvin cooler). Two samples of the same curve, so a
> crack has a hot core and a cooling margin. Between-world variety for lava worlds now comes from the
> CRUST (65/66 distinct), not the glow.

### 📐 SLICE 3 RECONNAISSANCE (2026-07-30) — measured, so nobody re-derives it

Done before writing any slice-3 code. **Slice 3 is a MULTI-SESSION port, not a one-sitting slice.**

**What is genuinely importable today, and what is not.**

- `planet-lod-height.glsl.js` exports exactly ONE thing — `HEIGHT_GLSL`, a 3124-line GLSL string — and
  **imports nothing.** `planet-lod-uniforms.js` exports `makeUniforms(WORLD_LIGHT)`.
- `HEIGHT_GLSL` declares **343 uniforms**. `makeUniforms()` supplies **340 of them.** The only five
  missing are the bake handles and their gates: `uReliefBakeCube`, `uReliefBakeStrength`,
  `uCraterBakeCube`, `uCraterBakeRestore`, `uProvinceCube`. Those are lab-local
  (`makeDummyCubeTexture()`, `world-engine-lab.html` ~1506-1535).
- **The game's planet material currently binds ZERO textures**, so the texture-unit budget the register
  warned about is a non-issue. The real cost was never units, it is the per-planet BAKE.
- ⭐ **The bakes are OPTIONAL and the shader says so.** At `uReliefBakeStrength = 0` the renderer
  **never fetches the cube** — the comment at `planet-lod-height.glsl.js:150` states "the height source
  stays the verbatim pre-AC2 fbmd line", and `uCraterBakeRestore = 0` is byte-identical the same way.
  Only 5 cube-sample sites exist, all behind 4 named accessors. **So the game can take the full
  analytic relief path with dummy cubes and ZERO per-planet bake cost.** Bakes can come later, for the
  near-LOD body only.
- ✅ **No coordinate-convention trap here** (checked, because this lane keeps finding them): the lab's
  `vPos` is `position`, object-space — the same quantity as the game's `vPosition`.

> ⛔ **`computeHeight()` IS NOT THE RELIEF LAW — do not "port slice 3" by wiring it in.** It looks like
> the entry point and it is not: `planet-lod-height.glsl.js:653` is a plain 4-octave `snoise` stack,
> barely different from the game's existing 2-octave `getSurfacePattern`. Wiring it would look like
> progress and buy nothing. The real height source is **`fbmd(vPos, uOctaves, fwBase)`** (line 777, an
> analytic-derivative FBM, up to 12 octaves with trailing-octave fade — self-contained, needs only
> `noised()` plus uniforms `makeUniforms` already provides) **plus the long combiner chain composed in
> the LAB'S `main()`**, roughly `world-engine-lab.html:350-700`, ~40 feature stages each with its own
> drivers. That chain is the actual slice-3 payload and it is what "still lab-only is the fragment body
> inside world-engine-lab.html" means.

**Suggested first increment (bounded, verifiable the same way slices 1-2 were):** swap the game's base
`snoise` for `fbmd` INSIDE the existing per-type `getSurfacePattern` branches, and use fbmd's returned
analytic gradient for the normal perturbation in place of the 3-sample finite-difference
`perturbNormalFromNoise`. ⚠ Do NOT replace `getSurfacePattern` wholesale — its per-type branches carry
the lava ridging, ice cracking, terrestrial continents, venus banding and carbon facets, and flattening
them would be a large uncommanded visual regression. Watch `uOctaves`: the lab drives it
`mix(4, 9, lodRamp)`, and the game renders many planets at once where the lab renders one.

⛔ **LANE COLLISION — check before starting.** `planet-lod-height.glsl.js` is also being edited by
`feature/world-engine-atmo-3b` (`~/projects/well-dipper-atmo`, lab on `:5178`), which has added ~320
lines to it. Measured 2026-07-30 via read-only `git merge-tree`: that file and `planet-lod-uniforms.js`
**auto-merge clean**; `world-engine-lab.html` **conflicts**. Importing these modules from the game
without editing them adds ZERO new conflict surface — which is the reason to do slice 3 that way.

### ✅ SLICE 3, FIRST INCREMENT — SHIPPED (2026-07-30). The land path's base noise is now `fbmd`.

**What changed.** The land path's base surface term moved from a 2-octave `snoise` sum to the lab's
analytic-derivative `fbmd`, and the relief normal moved from a 3-sample finite difference to fbmd's
returned analytic gradient. Per-type branches were NOT flattened — lava ridging, ice cracking,
continents, venus banding and carbon facets all still run; only what each branch uses as its BASE
was swapped. `uReliefMix` is the A/B dial and the safety valve: at 0.0 every body renders exactly
as it did in slice 2.

**How the code got there without touching the atmo-3b lane** — ✅ **RESOLVED 2026-07-30, the copy
is gone.** `hash3` / `noised` / `fbmd` were a VERBATIM copy in
`src/worldengine/shaders/heightNoise.glsl.js`, guarded by a byte-identity drift-guard
(`tests/height-noise-transcription.test.js`), because importing `HEIGHT_GLSL` would have cost
~76 KB gzip in the game bundle to reach 3 KB of noise, and hoisting the primitives properly meant
EDITING `planet-lod-height.glsl.js` — the file atmo-3b was rewriting. **That lane merged
(`c854c09`), so the hoist was done:** the three functions now live ONLY in
`heightNoise.glsl.js`, and `planet-lod-height.glsl.js` imports and splices them back at the two
points they used to occupy. The copy and its drift-guard are deleted.

⭐ **Why two constants and not one** (`HASH3_NOISED_GLSL` + `FBMD_GLSL`): in `HEIGHT_GLSL` these
functions are NOT contiguous — the `voronoi3d` keystone (with its own, differently-signed
`hash33`) and `emissiveBlackbody` sit between `noised` and `fbmd`. One combined block would
REORDER that file's declarations. Two splice back exactly where the originals were, which is what
made the resolved `HEIGHT_GLSL` **byte-identical, 265 920 bytes before and after** — the property
that matters, because six tests read that string and the lab shader must not shift.

⚠ **One guard had to be re-pointed, not dropped.** `tests/vis-scale-fence.test.js` pinned fbmd's
`uNoiseScale * 0.3 * uDispDomainScale` read site by grepping the RAW lab file, so the hoist turned
it red. It now asserts against the RESOLVED `HEIGHT_GLSL` — which is what its own comment says it
is protecting ("the shader binary cannot shift") — and keeps a second assertion against the raw
source for the prose-level token fence. Strictly stronger, and immune to the next hoist.

**⛔ `computeHeight()` was NOT wired in**, per the recon above. It is still the legacy finite-difference
height and is still what runs at `uReliefMix 0`.

#### The calibration, and why it is load-bearing (measured over 462 generated bodies, all 7 land types)

fbmd's octave amplitudes (0.5, 0.25, 0.125, …) sum to a spread **3.6x narrower** than raw simplex.
That ratio is a property of the amplitude series, not the frequency — it stayed flat across a 5x
domain-scale sweep. `pattern` feeds `height = pattern*0.5+0.5` against a fixed `seaLevel`, so an
unmatched spread moves the coastline on every world:

    terrestrial land fraction   legacy 0.571 | calibrated 0.592 (mean |Δ| 0.036) | UNCALIBRATED 0.818 (mean |Δ| 0.247)

Shipping it uncalibrated would have beached a quarter of every ocean. Constants:
`RELIEF_GAIN 3.648`, `RELIEF_GAIN_CONT 3.744`, `RELIEF_DOMAIN_SCALE 1/0.3` (puts fbmd's first
octave exactly on the legacy base frequency, so the noise LAW changes without the feature SIZE
changing; it also tightens how well one gain fits the population, spread 4.86 → 3.15).

#### ⛔ A FOURTH silent-disagreement bug at this seam, as the handoff predicted — this one is UNITS

The register's standing warning was "check units AND semantics AND SHAPE of every same-named
field; assume a fourth exists." It does, and it is in the game's own pre-existing code:

> **`perturbNormalFromNoise` finite-differences with a fixed `eps = 0.01` in OBJECT space, but
> `KnownSystems` bodies have object radii of 0.003–0.08.** On Ceres the step is **larger than the
> entire planet**. Legacy's "gradient" on every hand-authored body is therefore decorrelated noise,
> not slope — it renders as uniform sandpaper unrelated to the visible surface pattern.

This surfaced because fbmd's gradient is a TRUE derivative and so scales linearly with frequency,
and `noiseScale` spans ~100x across the game (generated bodies 1.5–5.0; KnownSystems 15–332 against
a tiny radius). Mean normal deflection, measured:

    body          noiseScale   legacy    analytic RAW   analytic ÷ base frequency (SHIPPED)
    generated        3.0        1.41°       1.38°                1.44°
    generated        4.5        2.13°       2.08°                1.45°
    ceres          332.4       17.15°      64.52°                1.46°
    haumea         236.8       15.73°      58.15°                1.50°
    titan           15.7        5.40°       7.42°                1.50°

Raw would have deflected Ceres' normal 64° — clamped and harsh. **So the gradient is divided by
fbmd's base frequency, making the term a dimensionless SLOPE**, and `RELIEF_NORMAL_GAIN 6.54` is
calibrated on DEFLECTION ANGLE against the regime where legacy is VALID (generated bodies, radius
≫ eps): legacy median 1.49° over 462 bodies, analytic 1.44–1.57° across a 100x frequency range.

⚠ **Consequence Max has not UAT'd:** hand-authored `KnownSystems` bodies (Ceres, Haumea, Makemake,
Eris, Titan) lose that 15–17° sandpaper and render smooth. That is an artifact removal, not a
regression — but it is a visible change to Sol, and it was NOT commanded. **Surface it if he plays.**

#### Frame cost — it is CHEAPER, with real LOD headroom

12 land bodies filling 3840x2160, median ms/frame, GPU-synced per frame (RTX 5080):

    legacy 3.3 (recheck 3.4) | oct4 2.5 (0.76x) | oct5 2.6 | oct6 2.7 | oct7 2.9 | oct9 3.4 (1.03x) | oct12 4.2 (1.27x)

The shipping config (4 octaves) is **24% cheaper than legacy**, because it deletes 3 full
`computeHeight` evaluations — 12 snoise calls — and fbmd's gradient comes free with its value.
**~9 octaves sit at legacy parity**, which is the budget for a later LOD ramp. At 1280x720 the whole
comparison is below the noise floor, so that resolution cannot be used to judge this.

#### A/B evidence (dial toggled on the real `Planet` class, % of body pixels changed)

    lava 39.13 | ceres-regime 32.75 | terrestrial 29.03 | rocky 23.07 | ocean 23.51 | ice 8.66
    carbon 2.31 (normal only — it overwrites `n` with its own stack)
    venus 0.000  ← negative control     gas giant 0.000  ← negative control

Venus is the strong control: same shader variant, same code path, `gReliefD` computed — but it
overwrites `n` and has `perturbStrength 0`, so it must not move a pixel, and it does not.

#### Deferred, deliberately

- ~~**This increment does NOT fix the band-collapse item below.**~~ ✅ **TAKEN — see "SLICE 3,
  SECOND INCREMENT" below.** It held relief strength AT the legacy median by design, building the
  mechanism (correct law, analytic gradient, 24% cheaper, headroom to 9 octaves). Raising it was
  the next lever and it has now been pulled: `RELIEF_NORMAL_GAIN` 6.54 → 39.24.
- **Relief strength no longer varies per body.** Normalizing out frequency also normalized out
  legacy's 1.03–2.13° spread. Restoring variation should drive it from a real condition scalar
  (roughness / erosion), not from `noiseScale`. Recorded, not taken.
- **`uReliefOctaves` is a flat 4.0** — no `lodLevel` ramp yet. The lab drives `mix(4,9,lodRamp)` for
  ONE body; the measured budget above says the game could too.
- **Venus and carbon never read the fbmd base for colour** (both overwrite `n` with their own
  stacks). Only their normals changed. Whether they should is a design question, not a port step.
- The ~40-stage combiner chain in the lab's `main()` — the actual slice-3 payload — is untouched.

### ✅ SLICE 3, SECOND INCREMENT — SHIPPED + **MAX UAT PASSED** (2026-07-30). Relief strength raised 6×.

> ✅ **Max UAT, verbatim: _"I'm fine with it btw it looks good to me."_** Judged on the
> `~/briefings/relief-strength-6x-2026-07-30.png` contact sheet. The 6× value is ACCEPTED, not
> provisional — `RELIEF_NORMAL_GAIN 39.24` is now the shipped look, and 8× stays available as
> headroom rather than as a pending decision.

**What changed.** One constant: `RELIEF_NORMAL_GAIN` 6.54 → **39.24**. Nothing else. 6.54 was the
PARITY value — chosen so the fbmd swap could ship without moving anything uncommanded. That job is
done; this is the deliberate, visible increase that addresses the band-collapse item below.

⭐ **Zero frame cost, and this is provable rather than measured.** The gain is a UNIFORM
(`uReliefNormalGain`), not a `#define`. The compiled shader is byte-identical to the previous
increment's — only a uniform's value differs. There is no work to measure.

#### The gate — and why the two obvious gates are both WRONG

Recorded because both cost real time to rule out:

- **Palette distinctness (the `183/330` measure) will not move**, as the previous handoff warned.
  Relief adds *shading* separation, not *colour* separation.
- ⛔ **Global luminance SD will not move either** — a second, less obvious trap. Measured flat, and
  in places *falling*, all the way to a 12× gain (rocky/collapsed 33.77 → 33.80; ice/collapsed
  40.63 → 38.63). The disc-scale terminator ramp dominates the luminance histogram and swamps
  relief entirely. **The working gate is LOCAL contrast**: mean |∇L| over the lit disc with the
  silhouette eroded 3 px, which isolates relief shading from both the terminator and the limb.

#### The measurement (60 bodies: 5 collapsed + 5 intact × 6 land types)

    type                x1 (6.54)   4x      6x (SHIPPED)   8x      lift at 6x
    ice/intact             2.58     4.31      5.67        7.09      +120%
    ice/collapsed          3.18     5.18      6.82        8.50      +114%
    rocky/collapsed        4.43     6.22      7.77        9.23       +75%
    rocky/intact           2.91     3.89      4.99        6.07       +71%
    terrestrial          10.01     10.89     11.70       12.59       +17%
    ocean                 6.63      6.91      7.15        7.44        +8%
    lava                  8.22      8.58      8.91        9.34        +8%
    carbon                3.38      3.21      3.20        3.21        -5%

⭐ **The gain SELF-LIMITS, and that is the reason to prefer it over a global contrast lever.** On
types whose colour stacks already supply contrast (lava ridging, coastlines, continents) relief
shading is a small addition, so they move 8–17%. On the flat ones it is most of what is there, so
they roughly double. **It lifts what is flat and leaves alone what is not.** Confirmed visually:
`~/briefings/relief-strength-6x-2026-07-30.png` is a legacy / 6.54 / 39.24 contact sheet — ice and
rocky gain real surface form, terrestrial barely moves, lava is indistinguishable.

⚠ **Note the axis.** Palette collapse turned out NOT to predict flatness — *type* does.
`rocky/collapsed` (4.43) renders with MORE local contrast than `rocky/intact` (2.91). The collapse
detector (`landPalette.fresh` exactly equal to `landPalette.weathered`) finds **143/462 = 31%** of
generated bodies, but the flattest-rendering bodies are `ice/intact` and `rocky/intact`.

#### Safety — the 60° clamp never fires

Measured in-shader by instrumenting the clamp on a THROWAWAY material clone (the real shader file
untouched), reporting pre-clamp deflection and the clamp flag as pixel channels:

    gain          median      p99        max      clamp fires
    x1  (6.54)    ~6.0deg    ~7.3deg   ~7.8deg      0.000%
    x6  (39.24)   8.5-10.6   16-22     27.6deg      0.000%
    x12 (78.48)   13.3-17.8  30-38     48.9deg      0.000%

**0.000% at 6×, and still 0.000% at 12×.** Max deflection at the shipped gain is 27.6° against a
60° limit. **8× is the next stop if this reads too subtle**; the headroom is real.

#### Negative controls, at exactly 0.000%

Across the WHOLE gain sweep (×1 → ×12), byte-identical renders:

    venus       local contrast 2.616, unchanged at every gain   (perturbStrength 0)
    gas giant   local contrast 8.524, unchanged at every gain   (never perturbs)

⚠ **These controls earned their keep.** The first run of this sweep showed the gas giant "changing"
60% of its pixels — which is impossible. The cause was in the HARNESS, not the shader:
`Box3.setFromObject` ran before `updateMatrixWorld`, so the FIRST shot of each body was framed from
stale matrices and every later shot was framed differently. Without a control pinned at exactly
0.000% that would have been read as "the dial works" and the whole calibration would have been
built on framing noise. Repeat renders are now asserted byte-identical before any sweep runs.

#### ⚠ An unreconciled number, recorded rather than buried

This session measures legacy's median deflection at **~6.0°** on rendered land pixels; the previous
increment's note records **1.49°** over the 462-body population. The probe was calibrated (writes a
known constant, reads it back linear to ±1 LSB across the full range), so it is not a distortion.
The definitions differ — per-rendered-land-pixel on collapsed bodies here, versus whatever
population/mask the earlier harness used. **What both agree on is PARITY, which is the load-bearing
claim**: measured through one identical probe inserted into BOTH normal paths, legacy and analytic
at gain 6.54 agree within 0.2° on every body (rocky 6.03 vs 5.92, terrestrial 5.81 vs 5.81). The
absolute figure is not reconciled and should not be quoted as if it were.

### ✅ SLICE 3, THIRD INCREMENT — SHIPPED (2026-07-30). `uReliefOctaves` ramps with distance.

**What changed.** `uReliefOctaves` was a flat `4.0` on every body at every distance. It now ramps
`4 → 9` as the camera closes, using **the lab's own law, imported not copied**:
`autoOctaves(lodRampOf(d))` from `planet-lod-lab-core.js`, i.e. `mix(4, 9, smoothstep(20, 6, d))`
where `d` is distance in body radii. `LODManager` already computed exactly that ratio for its tier
test, so this is one new call and one new method.

⛔ **NOT driven by the LOD tier, deliberately.** The obvious wiring — `lodLevel` is already a live
per-body uniform — is wrong twice over: the tier is discrete `0/1/2`, so it would step 4 → 9 in one
frame and **pop five octaves of relief into existence at once**, and `setLOD` early-returns when the
tier is unchanged, so the ramp would only ever move at tier boundaries. Taking the CONTINUOUS ratio
instead gives a fractional octave count, which is precisely what fbmd's trailing-octave weight
(`clamp(octaves - i, 0, 1)`) is built to consume: the newest octave fades in from zero.

#### Measured — octaves buy MORE relief than the gain raise did

Mean local |∇L| (same metric as the second increment), body rendered at fixed screen size:

    type           oct 4     oct 5.5    oct 7    oct 9     lift 4->9
    rocky           2.80      4.98      8.95    11.53       +312%
    ice             6.47      9.50     12.69    15.34       +137%
    lava           12.54     13.73     14.61    15.45        +23%
    terrestrial    13.68     14.66     15.43    16.24        +19%

**Same self-limiting shape as the gain raise** — the flat types gain most, the types whose colour
stacks already carry contrast gain least. Pixels-changed vs oct 4 climbs smoothly (24% → 34% → 41%),
no discontinuity anywhere on the ramp.

⚠ **Read the contact sheets at the right size.** `~/briefings/relief-octave-ramp-2026-07-30.png` is
a 320 px thumbnail grid and **overstates the graininess** — at fixed octaves, more pixels per feature
reads smoother. `~/briefings/relief-octave-ramp-closeup-2026-07-30.png` renders at ~370 px body
radius, which is representative of an actual close approach, and there oct 9 reads as rugged terrain
rather than sandpaper. Character note: it is UNIFORM roughness, because this is still bare fbmd —
the landform combiners (mountains, craters, canyons) are ladder rungs 4–6 and are what replace
uniform roughness with structure.

#### Cost — bounded by geometry, and no new measurement was faked

`lodRampOf` is `smoothstep(20, 6, d)`, so a body pays more than 4.0 only inside 20 radii and the
full 9.0 only inside 6. The budget was already measured in the first increment (12 land bodies
filling 3840×2160: oct4 2.5 ms, oct9 3.4 ms ≈ legacy 3.3 ms), and **this ramp is strictly cheaper
than that measurement**, which assumed every body at once. ⛔ No new frame-cost number is quoted
here: the first increment recorded that at 1280×720 the comparison is below the noise floor, and the
offscreen probe used this session runs at 320², so measuring there would have produced a number that
looks like evidence and is not.

#### Verification — and why it is a test, not an in-game check

⚠ **The ramp cannot be exercised by flying.** Verified live that `LODManager` *does* run — every Sol
body flips from the `lodLevel` initializer `1` to tier `0` within a frame — but every body in Sol
sits **10⁵–10⁷ radii** from the camera, so the ramp correctly returns a flat 4.0 and the interesting
part of the curve is unreachable. (Nor can the camera be teleported to force it: the game rebases
the world around a near-origin camera, so a written camera position is absorbed by the rebase.)

So it is pinned in `tests/relief-octave-lod-ramp.test.js` (7 cases): LODManager hands
`setReliefDetail` the ratio **not** the tier, it is called every update rather than on tier change,
absent implementations are tolerated, the law is flat 4.0 at ≥20 radii and exactly 9.0 at ≤6, and
the ramp is monotonic with max step < 0.15 octaves — a tier-driven ramp would step 5.0.
⭐ **Mutation-checked**: swapping `ratio` for `targetTier` at the call site turns the suite red on
exactly the tier-vs-ratio case, so the test is not passing vacuously.

### 📐 RUNG 3 — THE DECISION, MEASURED (2026-07-30). **Verdict: keep transcribing.** But every
### reason the handoff gave for that was wrong, and the real reason is a different number entirely.

The question: keep porting the lab's relief GLSL function-by-function, or import the lab shader
wholesale? The handoff named the blocker as *"the game builds a `THREE.ShaderMaterial` PER PLANET
and the lab shader declares 343 uniforms — wholesale probably needs materials shared per TYPE
first."* **Measured, that blocker does not exist.** A different one does.

#### The three assumed costs are all non-issues

    measurement                                      result                        verdict
    programs compiled for 18 planets, all 18 types   4 (shared, usedTimes 7/4/1/7)  NOT a problem
    active uniforms in the game's ROCKY program      53 (not 343)                   NOT a problem
    per-frame uniform upload, 343 vs 53 x 18 bodies  +0.19 ms = 1.1% of 60fps       NOT a problem
    per-fragment render cost, lab vs game shader     1.4x at equal disc coverage    NOT a problem

⭐ **"A material per planet" does NOT mean "a program per planet."** three.js caches compiled
programs by shader source, and the game has exactly THREE fragment sources (`GAS_BODY`,
`ROCKY_BODY`, `EXOTIC_BODY`, each appended to one shared `FRAG_HEADER`). 18 planets spanning all 18
types produced **4 programs**, shared. Sharing materials per TYPE would buy nothing that three.js
is not already doing.

#### ⛔ The real blocker: COLD SHADER COMPILE, ~29 seconds

    shader                        size      cold compile     warm (Chrome shader cache)
    GAS_BODY                    22.1 KB        576 ms
    EXOTIC_BODY                 28.9 KB      1 677 ms
    ROCKY_BODY                  31.4 KB      1 823 ms
    -- game total, 3 variants --            4 076 ms
    LAB wholesale              355.1 KB     28 751 ms                53 ms

Reproduced twice on independently cache-busted sources (28 751 ms / 28 084 ms), against 53 ms for
the identical source recompiled in a fresh context. **Wholesale import = a ~29-second freeze** the
first time each variant is seen — on a fresh install, after a driver update, or after any patch
that changes a shader byte.

⚠ **This nearly went in the register as a wrong number.** The first measurement read the cost as
33 s of *first draw* at 512², and a follow-up read compile as only 51 ms — both were artifacts of
Chrome's shader disk cache serving a previously-compiled binary. Only cache-busting the SOURCE
separates cold compile from everything else. Any future measurement here must cache-bust or it is
measuring the cache.

#### 🔶 A pre-existing finding, not caused by this lane: the game already pays ~4.1 s

The three shipped variants cost **4 076 ms of cold compile today**, unmeasured until now. That is a
real first-load hitch on any machine without a warm shader cache. Not fixed here, and worth its own
item — the mitigation is cheap and the plumbing exists: `KHR_parallel_shader_compile` **is present**
on this hardware, three.js exposes `compileAsync`, and **the game boots into an intro**, which is
exactly the window in which to warm the cache off the main thread.

#### The budgeting rule this gives the rest of the ladder

Cold compile runs **~26–81 ms per KB of fragment shader** (GAS 26, ROCKY/EXOTIC 58, lab 81 — mildly
superlinear, so bigger shaders pay worse per KB). ⭐ **Budget the remaining rungs in shader KB, not
in uniform count.** Rung 4 (mountains, craters + ejecta, canyons, plateaus) should be costed that
way before it is written, and only the stages actually used should be transcribed — dead stages
still cost compile time in every variant that carries them.

⚠ **One GPU, one driver, one browser** (RTX 5080 / Chrome / WSL2). Shader compile time is strongly
driver-dependent, so treat the ratios as sound and the absolute seconds as indicative.

### 📐 RUNG 4 SCOUTED, NOT STARTED (2026-07-30) — the big four landforms, costed before writing

Applying rung 3's own rule: **cost it in shader KB first.** Transitive call-graph closure of the
four combiners inside `HEIGHT_GLSL`, excluding `hash3`/`noised`/`fbmd` (already in the game):

    group        fns   KB     new dependencies pulled in
    mountains     5    8.5    fbmdRidged, grainProvinceRotate2, provinceWeight, sampleGrainStrike
    craters       7    9.6    craterProfile, ejectaProfile, hash33, provinceWeight, voronoi3d
    canyons       5    7.1    grabenProfile, grainProvinceRotate, provinceWeight, sampleGrainStrike
    plateaus      4    6.6    fbmdHetero, provinceWeight, terraceProfile
    ── UNION, deduped ──  17 fns, 19.4 KB  (province gating is 4.8 KB of that)

**Verdict: affordable.** `ROCKY_BODY` goes 31.4 KB → 50.8 KB, i.e. **+1.1 to +1.6 s of cold compile**
on that variant (at the measured 58–81 ms/KB). Against a current whole-game total of 4.08 s that is
real but not disqualifying — and it makes the async-shader-warmup item above more worth doing.

#### Two findings that change how rung 4 should be written

⭐ **"Province weight pinned neutral" has an exact mechanism, no stubbing needed.**
`provinceWeight` ends `return mix(1.0, fl + (1.0 - fl) * f, uProvinceWeight);` — so
**`uProvinceWeight = 0.0` returns exactly 1.0** for every feature id, `gProvince` never needs
initialising, and `initProvinces` need not be ported at all. (Optionally stub `provinceWeight` to
`return 1.0;` in the game copy to save the 4.8 KB and the ~50 `PROV_*` constants until rung 5 —
worth ~0.3–0.4 s of compile.)

⛔ **Mountains and canyons depend on a BAKED CUBE TEXTURE — and the game binds zero textures.**
Both reach `sampleGrainStrike`, which does `textureCube(uTectonicGrainCube, d).rg` to get the
tectonic strike direction that makes ranges read as *ranges* rather than blobs. None of the other
rung-4 dependencies touch a texture (verified: `fbmdRidged`, `fbmdHetero`, `craterProfile`,
`ejectaProfile`, `grabenProfile`, `terraceProfile`, `grainProvinceRotate*` are all texture-free).
**So craters + ejecta and plateaus are portable today; mountains and canyons are not, as written.**
Three ways out, in preference order:

1. ⭐ **Compute the strike analytically.** The grain cube's own header says it "stores a smooth
   WORLD-space strike that is a pure function of |lat| (latitude bands — it carries ZERO
   within-body longitudinal structure)". **A pure function of latitude does not need a bake.** If
   that comment is accurate, the game can evaluate the strike in-shader for free and skip the
   texture entirely. Verify the claim against the baker before relying on it.
2. **Grain off**: `uTectonicGrainStrength = 0` is a documented byte-identical fallback gate, and
   `sampleGrainStrike` also falls back to the dir-tangent on a degenerate/black cube. Cheapest, but
   mountains lose their strike alignment and read as blobs — a visible downgrade.
3. **Do the per-planet bake.** The slice-3 recon already warned this is the real cost of the lab
   path ("the real cost was never units, it is the per-planet BAKE"). Last resort.

**Suggested order for rung 4:** craters + ejecta first (fully portable, most visually distinctive,
9.6 KB), then plateaus (6.6 KB, also portable), then resolve the grain question and take mountains
+ canyons. ⚠ Expect each to need its own amplitude calibration against the game's height scale, the
way `RELIEF_GAIN` did — the register's standing lesson is that a same-named quantity across this
seam has now produced four silent-disagreement bugs.

### ⛔ RUNG 4, CRATERS — MEASURED BEFORE WRITING (2026-07-31). The shader port is the easy half. The
### hard half is that the game's generated universe has NO SURFACE THAT KEEPS A CRATER RECORD.

`tools/port-crater-measure.mjs` (run it; it prints all three sections below). The scouting note above
costed craters in shader KB and called them "fully portable". Both are true and both are beside the
point: **transcribing the lab's crater law unchanged renders nothing, on almost every body in the
game, for two independent reasons.** Neither is a bug in the crater law — the law is behaving
correctly on the inputs it is given. Measure before writing was worth it here.

#### ⛔ Finding 1 — the game generates NO AIRLESS BODIES, so craters are correctly suppressed

Over **504 generated bodies** (7 land types × 6 orbits 0.4–12 AU × 12 seeds), the bombardment
schedule FIRES on 418 and `craterRelevanceOf` returns 1 on all 418 — the domain gate opens fine. The
crater record then evaporates in the exposure age:

    type          impact  fired  relevant  median tExp   median coverage
    rocky          69/72     69        69     1.00e+0        1.78e-4
    ice            67/72     67        67     1.00e+0        1.55e-4
    lava           68/72     68        68     1.00e+0        1.60e-4
    ocean          60/72     60        60     1.00e-1        1.50e-5
    terrestrial    60/72     60        60     1.09e-1        1.65e-5
    venus          24/72     24        24     0.00e+0        0.00e+0
    carbon         70/72     70        70     1.00e+0        1.69e-4

Against the lab's airless presets, whose coverage is **0.26**. That is a **1500×** shortfall, and the
mechanism is exact: `tExp = min(age, T_RESURF_TIDAL/td, T_RESURF_ERODE/erosion)`, the **erosion term
binds on 271/288** rocky-family bodies (age binds on 1), and `chronN` is exponential in `tExp` —
`chronN(4.6)/chronN(1.0) ≈ 4600`. A surface exposed for 1 Ga instead of 4.5 Ga keeps essentially no
craters. **That is correct physics**: real Earth's ~0.1 Ga continents carry a measured crater coverage
of ~1e-5, which is what the law returns.

⭐ **The root cause is upstream of the world engine and is not a crater problem at all: every rocky
body the game generates retains an atmosphere.** Measured over 288 rocky/ice/lava/carbon bodies:

    pressure (bar)   min 0.106   p10 0.328   median 0.779   p90 12.5   max 18.4
    bodies with P < 0.01 bar (near-airless):   0 / 288
    atmosphere.physics.retained === true:    288 / 288

There is no Moon, no Mercury, no Ceres anywhere in the generated universe — the minimum atmosphere in
the game is denser than Mars'. `erosionOf` is `smoothstep(0, 0.5, P) · max(waterWindow, 0.1)`, so a
floor of 0.106 bar is a floor of 0.0115 on erosion, and the observed median erosion is **exactly
0.1000** (the `DRY_ER_FLOOR`, i.e. every body is at least a dry-wind-eroded world). ⚠ **This is a
`PhysicsEngine.computeAtmosphere` finding, NOT a rung-4 one, and it suppresses far more than
craters** — it also pins `airlessnessOf`, the space-weathering colour stage, and the greenhouse
correction. Deciding whether the atmosphere model should produce airless worlds is Max's call: the
blast radius is every planet's atmosphere/cloud read, though NOT the generated universe itself (no
`rng` draw changes).

#### ✅ Finding 2 — Sol's hand-authored bodies DO keep a crater record, and are where the port lands

Sol's records carry `atmosphere: null` (and the moon builder forces `atmosphere: null` outright), so
erosion is 0, `tExp` is the full 4.5 Ga, and the schedule returns a real population. Derived density
(fraction of voronoi cells hosting a crater), full-SFD band:

    Mercury 0.340   Callisto 0.337   Ganymede 0.360   Io 0.272   Europa 0.242
    Moon    0.263   Triton   0.217   Charon   0.117   Ceres 0.097   small ice moons 0.05-0.14

**37 of 39 Sol bodies render craters.** Those are the right bodies and roughly the right amounts.

⛔ **But three of them are wrong, and the reason is a FOURTH silent-disagreement bug at the same
adapter seam.** Sol's Earth, Venus and Mars derive densities of **0.704 / 0.677 / 0.437** — Earth
comes out more cratered than the Moon. Their records carry a VISUAL atmosphere wrapper
(`{color, strength}`) with no `.physics` block, and `atmosphereFromPlanet` has
`if (!phys) return gameAtmosphere;` — a branch written for engine-shaped lab presets, which happily
passes the visual wrapper through as though it were one. `pressure` is then `undefined → 0` and the
engine reads Earth as a vacuum. The three documented bugs at this seam were `T_eq` semantics, density
units and `pressure` nesting; **this is the fourth, and it is the same branch that fixed the third.**
The discriminator is available and needs no new data: an engine-shaped atmosphere HAS a `pressure`
field, a visual wrapper does not. Sol's records also carry no `T_eq`, no `age`, no `massEarth` and no
`composition`, so those default to 288 K / 4.5 Ga / 1 M⊕ — which is why Sol's Moon derives a surface
gravity of 13.4 g instead of 0.165.

#### ⭐ Finding 3 — the band decision: the lab's crater band is SUB-PIXEL in the game

The lab's synth deliberately renders only the **sub-floor** band — every crater too small for the
lab's display mesh to stamp as real geometry — because the lab's big craters are a per-planet BAKE.
**The game has no stamp pass and no bake, so it has nothing to avoid double-rendering, and inheriting
that band hands the game the one part of the distribution it cannot see.** Measured on Sol, as the
mean crater's diameter in pixels on a planet drawn 400 px across (the `px @200R` column):

    band              med density   med px @200R   what it reads as
    sub-floor (LAB)      0.0858          0.8       ⛔ sub-pixel — aliasing, not craters
    full SFD             0.1402          3.5       fine stipple; ~8000 craters/disc
    vis 0.02 rad         0.0733         20.6       ⭐ ~50 craters/disc at ~20 px — reads as cratered
    vis 0.05 rad         0.0562         32.6       ~16 craters/disc — sparse, big
    vis 0.10 rad         0.0432         46.2       a few basins only

**Take the 0.02-rad band.** The law is the same shape as the lab's, with the floor swapped for the
one that actually binds: the lab clips at its MESH floor (`MESH_FLOOR_RAD = 0.055`), the game clips
at its RASTER floor. `D_char = geomean(max(L, 0.02·R_km), H)`, `uCraterScale = R_km/D_char`,
`uCraterDensity = coverage(band)/CELL_CRATER_AREA`, `uCraterAmp = radPerKm·D_char`.

⚠ **Stated limitation, not a defect:** the coverage of a `D^-2` SFD is flat per decade of size, so a
real cratered surface is self-similar and ONE voronoi octave can only ever show ONE size. The game
renders the octave its raster resolves; the sub-resolution population is already carried by the
9-octave `fbmd` relief. A second combiner call at 3× scale would add a size decade for ~2× the
crater ALU (same KB) — recorded, not built.

⭐ **`uCraterComplexD` must NOT be transcribed.** The lab pins it at `HASH_TAIL_MAX/0.6` to force
`morphology ≡ 0`, because every sub-floor crater is a simple bowl. The game's craters are ~0.1 R
across — 245 km on the Moon — which are **complex craters**, and central peaks plus wall terraces are
most of what makes a big crater read as a crater. The game should feed the real gravity-set
transition diameter (`transitionDiameterKm(g)`, already exported) in cell units.

⭐ **The crater slope is body-independent, which removes one calibration.** `uCraterAmp · uCraterScale
= (D_char/R_km) · (R_km/D_char) = 1` exactly, so `craterCombiner`'s gradient reduces to
`profile' / craterRadius` — a pure aspect ratio. Craters cannot inherit the `noiseScale` spread that
forced `perturbNormalAnalytic`'s divide-by-base-frequency. They must therefore be accumulated
SEPARATELY from `gReliefD` and added AFTER that division, in a unit-sphere domain (`normalize(pos)`),
not in the object-space domain `fbmd` reads.

### ✅ RUNG 4, CRATERS — SHIPPED + LIVE-VERIFIED (2026-07-31). And the density law needed a
### calibration that no amount of reading the lab source would have produced.

Offscreen probe, 512², ROCKY variant, ANGLE / NVIDIA RTX 5080 / D3D11. Sol's Moon unless stated.

    negative control (crater code textually REMOVED vs uCraterDensity = 0)   0.000000%
    liveness (craters off -> on)                                                2.95% of pixels
    local contrast, mean |grad L| over the lit disc, silhouette eroded 3 px    2.971 -> 3.310
    contrast lift                                                              +11.4%
    60-degree clamp firing rate                                              0.0000% of lit pixels
    deflection with craters   p50 10.24 / p90 16.24 / p99 22.59 / max 52.94 degrees
    deflection terrain only   p50 10.24 / p90 16.24 / p99 21.18 / max 30.00 degrees
    ROCKY fragment shader          34.59 KB -> 41.16 KB   (+6.57 KB)
    cold compile, cache-busted     2431 ms -> 2642 ms     (+211 ms, 32.1 ms/KB)

⚠ **The first negative control I ran was 0.000000% AND the liveness was 0.000%, and both were
artifacts** — the harness was rendering a black frame. Sol's moon records carry no `axialTilt`, so
`Planet`'s `this.mesh.rotation.z = this.data.axialTilt` wrote `undefined`, the world matrix went NaN
and nothing drew. A negative control passes trivially on an empty frame. **The probe now asserts a
lit-pixel floor before any percentage is believed**, and that assertion is the reusable part.

**Cost came in UNDER the scout's estimate: 6.57 KB against 9.6 KB**, because of two divergences the
port took (both commented at the site in `craterRelief.glsl.js`): the lab's separate crater and
ejecta combiners were MERGED — they ran two `voronoi3d` calls over an identical domain with identical
cells, hash, host gate and radius, so merging is exact and halves the dominant 27-`hash33` cost — and
`provinceWeight` is stubbed to `return 1.0;`, which is what `uProvinceWeight = 0` returns anyway.
32.1 ms/KB sits at the low end of the register's 26–81 ms/KB model. ⓘ The ROCKY variant is now
41.16 KB, well past the "~33 KB Chrome/ANGLE compile limit" `Planet.js`'s own header warns about, and
it compiles clean — on this one driver. That warning is not binding here, but it has only been tested
against ANGLE/D3D11.

#### ⛔ THE CALIBRATION: the shader paints 2.66× less crater than the law believes

The lab's density law inverts a per-cell area of `pi*E[craterRadius^2] = 0.4544` — the area of a flat
disc of the hashed radius. **The shader does not paint a disc.** `voronoi3d` partitions a 3D LATTICE:
a crater is a BALL about a jittered centre that generally does not lie on the sphere, so the surface
sees a spherical CAP of radius `sqrt(R^2 - z^2)`, and that cap is then clipped to its own voronoi
region, which for the top of the hash range is smaller than the ball. Measured in-shader, at
`uCraterDensity = 1` so that every cell hosts and the low-density sampling noise is gone:

    body        rendered cavity coverage at density 1
    Moon                    0.1495
    Mercury                 0.1593
    Callisto                0.1615
    Europa                  0.1931
    Ganymede                0.1898
    ── mean 0.1706, sd 0.0175 (10.3% spread) ──   against the analytic 0.4544

So `RENDERED_CELL_COVERAGE = 0.1706` replaces `CELL_CRATER_AREA` in the density derivation, and every
body gets 2.66× more craters. Sol's Moon goes 0.128 → 0.342, Mercury 0.161 → 0.430, Mars 0.202 →
0.538. The visual result is the difference between "a few faint dents" and a crater-scarred world;
liveness went 1.31% → 2.95% and contrast lift 6.4% → 11.4%.

⚠ **Do NOT calibrate this at low density.** `coverage/density` wanders between 0.082 and 0.160 over a
0.05→0.4 sweep, because `step(1 - density, hash)` changes WHICH cells host, not just how many, and
one hemisphere only shows ~40 craters. The `density = 1` anchor has ~600 and is the only stable one.

⚠ **0.1706 is also the CEILING.** One crater per cell means the game cannot paint more than ~17%
coverage however bombarded a world is, so a genuinely saturated surface renders under-cratered. Same
single-octave limitation as the band note above, seen from the amplitude side.

#### What did NOT need calibrating, and why that is the interesting half

`uCraterAmp * uCraterScale == 1` EXACTLY — the amplitude is the characteristic crater's angular
diameter and the scale is its reciprocal — so `craterEjectaCombiner`'s gradient reduces to
`profile'(r) / craterRadius`, a pure aspect ratio, identical on Ceres and a super-Earth. Measured
crater slope p50 0.094 / p90 1.349 / p99 2.761 / max 5.459, exactly the profile's own aspect ratio
and independent of the body. **So `CRATER_RELIEF_GAIN = 1.0` rests on an identity, not on a
population fit** — unlike `RELIEF_NORMAL_GAIN`, which needed 462 bodies. This is the one quantity at
this seam that could not disagree with itself.

That identity is also why craters are accumulated SEPARATELY from `gReliefD` and added AFTER
`perturbNormalAnalytic`'s divide-by-base-frequency: the crater gradient is already a dimensionless
slope, `fbmd`'s only becomes one after that divide, and folding them early would rescale every crater
by `noiseScale`, which spans ~100× across this game's bodies.

### ⭐⭐ 2026-08-01 — STAGE 0 SHIPPED + LIVE-MEASURED: the freeze is gone, and the render target
### turned out to be worth 10×

Stage 0 is the enabler for everything below — nothing from the lab's pipeline can land while its
shader costs ~29–47 s of cold compile. It shipped as `src/rendering/ShaderWarmup.js`, fired from
main.js on the title screen (which spawns a **nebula**, so no planet material has ever been built
there and the player is reading a logo with nothing waiting on it). Commits `9da286b` (build) and
`d87a8fe` (measurement + a fix the measurement forced).

**The mechanism in one line:** three programs, not eighteen. The planet TYPE only chooses which
fragment BODY is concatenated onto the shared header, and three caches GPU programs by shader
SOURCE — so warming three programs warms every planet in the game. `PLANET_SHADER_VARIANTS` is
exported from `Planet.js` rather than retyped in the warm-up, because "same source" IS the whole
mechanism.

#### The measurement — four ways into a system, worst frame recorded

rAF confirmed at 240 fps *before* trusting anything (a backgrounded Chrome throttles to ~1 fps while
`document.hidden` reports false). `window.__shaderCacheBust` changes the shader SOURCE, so "cold"
means cold rather than served out of Chrome's shader disk cache.

    cell  warm-up            bound target      worst frame
    ----  -----------------  ----------------  -----------
      2   none               —                 5 424.5 ms     <- what the game paid before this
      3   yes                canvas (WRONG)      606.5 ms
      4   yes                sceneTarget          58.7 ms
      1   title-screen auto  sceneTarget         137.8 ms      (first-ever Sol entry, so it also
                                                                carries texture + geometry work)

**5 366 ms of a 5 424 ms freeze removed — 99%.** Median frame is 4.2 ms in every cell; the entire
cost is one frame. Warm entry has now measured 58.7 / 66.1 / 137.8 ms across three runs and has
never produced a frame over 500 ms; cold has never produced fewer than exactly one.

⭐ **The render-target binding is worth 10.3×, and is now a number rather than an inherited warning.**
Cell 3 is cell 4 with one line changed. The program cache key bakes in `toneMapping` +
`outputColorSpace`, both read from the **currently-bound target**, so warming against the canvas
links a program the game never asks for. It is not a total loss — 606 ms against 5 424 — and that is
precisely what makes it dangerous: **it looks mostly fixed.** main.js's warp gate documents this trap
as "Goal 3b"; this is the first time the lane has measured it.

⚠ **Cold cost is a RANGE, not a constant:** 5 424 ms on a page's first cold link, 2 563 ms later in
the same page once ANGLE's own translation caches are warm. The first-ever link is the worst case,
and the first-ever link is the one a player hits. Report it as 2.5–5.4 s.

⚠ **Sol is a legitimate vehicle for THIS measurement** even though it is the wrong place to judge
surface look. The program is chosen by body TYPE, not by system, so compile cost is
system-independent. Do not generalise that to any look measurement.

#### What the measurement forced: the warm-up was serialized

It awaited each variant before starting the next, so the driver never had more than one link in
flight and the total was the SUM rather than roughly the longest.
`KHR_parallel_shader_compile` exists to overlap them.

    serialized   4 263 ms
    parallel     2 667 / 2 701 / 2 728 ms      (three runs, fresh source each)

1.6×. The per-variant figures now **overlap** (rocky 2 663 / exotic 2 658 resolving together), which
is the direct evidence of concurrent linking rather than merely a faster total. Kickoff is still one
variant per animation frame — three ~100 KB synchronous hand-offs in one frame is a visible
title-screen stutter, the exact thing this module exists to remove. This matters because the title
screen is not infinite: a player who dismisses it fast gets only the variants that finished, so
sum-vs-max is a difference in how much of the win actually lands.

#### The other half of Stage 0, built but not yet exercised

`swapMaterialWhenReady()` — render with the shader we have, link the target shader off the main
thread, swap the material in when the promise resolves. Nothing calls it yet; it is what Stage 2
will use to bring the lab's material in without a freeze. ⚠ It is a **different axis** from
`BodyRenderer.setLOD`'s procedural↔textured swap, which has a standing rule that it never returns to
procedural. This one is procedural→procedural (cold→warm) and must not be routed through that path.

#### The one invariant with no runtime failure signal

`tests/shader-warmup-source-parity.test.js` (7 tests). If the warm-up's source ever stops matching
the body's source, the warm-up still runs, still resolves, and **still reports a healthy multi-second
compile** — while warming a program nothing draws. There is no error, no warning, and no symptom
except that the win quietly disappears. Hence `window.__shaderCacheBust` is read inside the single
shared accessor `planetShaderSource()`, so a measurement run cannot bust one path and not the other.

### ⭐⭐ 2026-07-31 — MAX CHANGED THE TARGET: put the LAB'S PIPELINE in the game, procgen and
### rendering, asap. The transcription ladder is the wrong vehicle for that. SPIKE MEASURED.

The rung-by-rung ladder (rungs 0–4: `fbmd` base, relief ×6, octave ramp, craters) answers "graft the
lab's features onto the game's type-branch shader." Max's target is the other option in
`lab-vs-game-renderer-divergence.md` §4.1 — **replace**. A spike put the lab's ACTUAL material into
the game page to find the real blockers in one go instead of discovering them one rung at a time.

#### What the spike established

    the lab's shader is fully extractable from the game               ✅
      Vite's html-proxy module (world-engine-lab.html?html-proxy&index=0.js), 3.33 M chars;
      vertexShader 1 661 chars, fragmentShader 101 284 chars, ONE interpolation (${HEIGHT_GLSL}).
      Resolved: 355.1 KB, 349 uniforms — matches the register's wholesale figure exactly.
    it COMPILES AND LINKS CLEANLY inside the game page                ✅  LINK_STATUS true, empty log
    the lab's vertex shader does NOT displace geometry                ✅  plain sphere, so the
      game's mesh is compatible; it needs 4 zero-filled attributes (aBand/aShear/aMush/aStorm).
    per-frame render cost                                            ✅  0.51 ms at 384^2
    cold compile                                                     ⛔  46 750 ms compile+first
      draw at 384^2 in the spike, against the register's 28 751 ms cache-busted compile-only.
      Tens of seconds either way. THIS IS THE ONLY REAL BLOCKER.
    makeUniforms() defaults alone render BLACK                       ⛔  forced-output test says the
      mesh rasterises 76.21% and the SHADER computes black. The lab overwrites its defaults at route
      time, so the uniform-driving half is not optional decoration — it IS the procgen work.

⚠ Two harness traps cost time again, both the same shape as the crater probe's NaN world matrix:
`makeUniforms(WORLD_LIGHT)` takes the light vector, and calling it with no argument yields
`uLightDir = [null, null, null]`; and a black frame looks exactly like a working negative control.
**Force a constant fragment output to separate "not rasterising" from "computing black" before
diagnosing anything else.** That one test would have saved both detours.

#### The consequence for the ladder — a STOP-DOING decision

If the game is going to run the lab's shader, then transcribing the lab's remaining landforms into
the game's shader is **work that gets deleted**. Rung 4's craters are already shipped and are worth
keeping as the fallback path, but **rung 4's plateaus, rung 5's provinces, and mountains/canyons
should NOT be written.** The grain-cube question the last handoff flagged as the next blocker
dissolves too — under replace, the lab's own `sampleGrainStrike` comes across with everything else,
and the question becomes the per-planet BAKE, which was always the real cost.

#### The staged plan the measurements imply

    STAGE 0  async compile + swap-on-ready         THE ENABLER — nothing ships without it
      Render with today's shader; compile the lab shader off the main thread
      (KHR_parallel_shader_compile is present, three exposes compileAsync); swap the material when
      it resolves. Turns a ~29 s freeze into a progressive upgrade that never blocks the player, and
      it also retires the 4 076 ms first-load hitch the game already pays today.
    STAGE 1  the uniform driver (pure JS, no compile cost)
      game planetData -> lab `fp` -> deriveUniforms -> the 349 uniforms, extending the existing
      conditionFromPlanet seam in src/worldengine/port/. This is what turns the black frame into a
      planet, and it is the "procgen" half of Max's ask.
    STAGE 2  one land type end-to-end in a procedural system (Caph), bakes gated OFF via their
      documented byte-identical gates (uTectonicGrainStrength = 0, uProvinceWeight = 0).
    STAGE 3  the bakes — tectonic grain, crater, river carve. The real per-planet cost, and the
      thing the slice-3 recon warned about. Deferred until 0–2 land.
    STAGE 4  moons. src/objects/Moon.js is a THIRD renderer with none of the port; 267 of 277 moons
      within 25 pc derive a crater record and 0 render one.

### 🔶 Recorded, PARTLY ADDRESSED — the honest palette flattens elevation banding on ~45% of bodies

> **2026-07-30:** the shading half of this is now addressed by the 6× relief raise above — the
> flat bodies get their elevation form back from *shading*. The COLOUR half stands unchanged:
> `fresh` still comes out equal to `weathered` on 31% of generated bodies, and the `craton` swap
> below is still untaken.

Now that pressure arrives, atmospheric worlds get erosion ~1, which kills oxidation (it rides
`1 - erosion`) and airlessness, which kills space weathering. Both alteration stages therefore produce
nothing and **`fresh` comes out EQUAL to `weathered`** — physically right (a heavily eroded world
re-exposes fresh rock everywhere) but it merges the shader's highland and peak bands. Measured over
330 bodies: the current `{fresh, weathered, sediment}` binding gives 3 distinct colours on only
**183/330**. Swapping `craton` in for `weathered` lifts that to **210/330** — a marginal win for a
uniform plus a semantic change to the highland band, so it was recorded rather than taken. The lab does
not have this problem because it layers relief, province, frost and dust on top; the game's ROCKY_BODY
has only these three colours. **The real answer is slice 3 (the relief / province GLSL), not a fourth
colour.** Between-WORLD variety is unaffected (61-65 distinct weathered tones per 66 bodies).

### Built and landed

- **`src/worldengine/display/albedoTransfer.js`** — the albedo display transfer, extracted out of the
  lab's `applyDrivers` into ONE shared module the lab and the game both import. This section used to
  warn that the transfer was "the single most likely thing to be lost in the port"; it is now
  structurally impossible to lose instead of merely warned about. The extraction is byte-identical
  across all 18 presets x 5 endmembers x 3 channels (verified, max delta exactly 0).
- **`src/worldengine/port/conditionFromPlanet.js`** — the ONE named seam where game data enters the
  engine. It reads `planetData.type` for **nothing**, deliberately: if a future edit needs the label to
  make something come out right, the LAW is underspecified — add the missing condition scalar instead.
  It also carries the greenhouse correction described in blocker B.

### ✅ Blocker A — RESOLVED by wiring the land path only

`baseColor` and `surfacePaletteOf()` are NOT the same quantity, and the fix was to respect that rather
than reconcile it. What shipped:

- `PlanetGenerator` now attaches `landPalette` (fresh / weathered / craton / sediment) to every planet,
  derived through `conditionFromPlanet` -> `surfacePaletteOf` -> `applyAlbedoTransfer`.
- `Planet.js` gained `uFreshColor` / `uWeatheredColor` / `uSedColor`, with fallbacks to the old
  constants so a hand-authored fixture never renders black.
- **Terrestrial (type 5):** `highland` and `peak` WERE hard-coded `vec3(0.42,0.38,0.34)` and
  `vec3(0.6,0.58,0.55)` — shared by every planet in the game, the exact defect the lab retired when
  it made the weathered endmember condition-derived. They are now `uWeatheredColor` and
  `uFreshColor`; `midland` is `uSedColor`. (The lab spelled that endmember `uBaseColor` until
  2026-08-06; both frontends say `uWeatheredColor` now.)
- **Rocky (type 0):** got its own branch — a dry world IS its bedrock, so the whole surface is the
  palette (sediment in the lows, weathered background, fresh rock where relief exposes it).
- **Deliberately NOT ported:** ocean water, ice caps, clouds, gas bands, venus, carbon, lava. Those are
  separate layers with their own colours in the game as in the lab, and they still read
  `baseColor`/`accentColor`. That layering is the whole reason blocker A existed.

Verified in the game (port 5175 root — NOT 5173, which is the supercruise worktree): shader compiles
clean (glError 0, no diagnostics), and two rocky bodies at the same orbit now render visibly different
by iron fraction (0.10 -> pale #9f856c, 0.42 -> dark #544135). Before, both were a random pick from the
same 13-entry list.

### Original blocker A note (kept — it is why the layering must be preserved)

`surfacePaletteOf()` returns **land bedrock** endmembers (fresh / weathered / craton / sediment). The
game's `baseColor` is a **whole-body** colour, and the shaders consume it as such:
`vec3 deepOcean = baseColor * 0.8`, `surfaceColor = mix(baseColor, accentColor, zoneMask)` for gas
bands, and the ice path likewise. Substituting one for the other turns **every ocean brown and every
gas giant tan**. Measured across 11 types x 2 orbits: every derived colour landed in a narrow
brown/tan band (#69–#84), because that is what bedrock IS.

**What the port actually needs:** wire the derived palette into the **land path only** — the game's
`ROCKY_BODY` land branch — and leave the ocean, ice, cloud and gas-band layers on their own colours,
exactly as the lab does (the lab's ocean/ice/cloud layers are separate from `uWeatheredColor` too). The
lab's architecture already has this right; the port has to preserve the layering, not flatten it.

### ⛔ Blocker B — the two sides disagree about what `T_eq` means (FIXED at the seam)

  game   `PlanetGenerator.T_eq` = `equilibriumTemperature(luminosityRel, orbitAU)` — bare radiative
         balance, **no greenhouse**. There is no surface-temperature field anywhere in game planet data.
  engine `condition.T_eq`       = **SURFACE** temperature (`body-condition-vector.js` says so; the lab's
         Venus preset is 737, its surface value).

Same field name, different physical quantity, and nothing warns you. Passing it straight through hands
every temperature-gated law the wrong number: a game Venus arrives at ~329 K instead of 737 K, so the
erosion water-window, iceness, biosphere, crater and atmosphere-optics gates all read it as temperate.

**Fixed** in `conditionFromPlanet.js` with a grey-greenhouse conversion,
`T_surf = T_eq*(1 + 0.75*tau)^0.25`, `tau = 0.84*P^1.124`. Two constants solved from Earth and Venus;
checked against four bodies that were NOT fitted: Mars +0.1%, Titan +3.7%, Moon and Europa exact
(airless is exact by construction, P=0 => factor 1).

### ❌ Blocker C — WITHDRAWN. It was a measurement error of mine, recorded so nobody re-derives it.

I originally reported that the game's bodies barely vary in condition space and that the port would
therefore REDUCE visible variety. **That was wrong, and it was wrong because I measured a two-orbit
slice at fixed metallicity.** Over a realistic population (11 orbits x 6 metallicities, n=66):

    T_eq   43 - 657 K        iron   0.10 - 0.51
    vf     0.013 - 0.65      C/O    0.20 - 1.00

and the derived bedrock gives **17 distinct colours over 21 rocky bodies**. The game's population is
well differentiated and the derive tracks it. The lesson is the one this lane keeps relearning: a
spread measured at fixed parameters is not the population's spread.

**Two real (smaller) defects did survive the re-measurement:**

1. **`deriveComposition` uses ONE `rngFloat` scalar for all three composition axes**, so
   `ironFraction` and `carbonToOxygen` are correlated at **r = 1.000** — a 3-D composition space
   collapsed onto a line. (`volatileFraction` is independent, r = 0.03, because the frost-line term
   dominates it.) Worth fixing; does not block the port.
2. **`T_eq` has no albedo term**, so at a given orbit every type gets an identical value (329 K at
   0.6 AU). Physically the spread should be ~±15% across albedo 0.1-0.7. Minor.

### Original blocker C note (superseded by the above)

At a given orbit, **every type gets the same `T_eq`** (329 K at 0.6 AU, 147 K at 3.0 AU — it is a pure
function of orbit and luminosity, with no type, albedo or greenhouse input), and `ironFraction`
clusters in 0.23–0.33 for everything. The lab's presets span `T_eq` 55–2000 K and iron 0.03–0.70.

**Consequence, and it is the uncomfortable one:** even after Blocker A is fixed, condition-derived
colour in the game would vary *less* than the current hand-picked `PALETTES` table, because the
conditions feeding it barely vary. **The port as a straight swap would reduce visible variety — the
opposite of the goal.** Blocker C is really a defect in `PlanetGenerator`'s composition/temperature
generation that the port merely exposes. Fixing it means making the game's generated bodies as rich in
condition space as the lab's presets are, and that is a decision for Max about scope, not a mechanical
port step.

---

### Original notes (still valid)

- **All of this lives in `src/worldengine/**` and is framework-free and deterministic** —
  `surfaceMaterial.js` imports nothing, reads only condition scalars, and contains no label /
  archetype / regime read. It ports as-is. The *law* is not the hard part of the port.
- **The display transfer is lab-side, not module-side** (in `applyDrivers`). That was deliberate so
  the physics module stays honest — but it means **the port must carry the transfer across too**, or
  planets will render ~2.5× too dark in the game. This is the single most likely thing to be lost in
  a port.
- **The province cube is a new GPU resource** (`createProvinceCube`, 128³ HalfFloat RGBA, baked
  once per `route()`). The game will need the same bake cadence and an equivalent binding.
- **Three cubes are now live** — grain, height/relief, province — plus the crater cube. Worth
  checking texture-unit budget on the game's material before porting.
- **`uProvinceColorMix` default 0.65 is semantic, not taste** (province thresholds make craton ~70%
  of the surface, so full mix replaces the background everywhere). Don't "clean it up" to 1.0.

---

## A real testing gap, not a deferral

**The test suite structurally cannot catch lab breakage.** During this work a stray backtick inside
the fragment-shader template literal terminated the string and broke the entire page with a bare
`SyntaxError` — and the full suite passed clean, 20684 tests, because **nothing in `tests/` loads
`world-engine-lab.html`**. Only booting the page found it.

Any GLSL or lab-wiring change is currently verified only by a human (or an agent) opening the page.
A minimal smoke test that boots the lab headlessly and asserts `window._lab` exists plus a clean
console would close a whole class of failure that is invisible today.

---

## Standing baseline

Full suite: **20684-20685 passed / 4 failed** (the passed count drifts by one run to run). The 4 are pre-existing (`KnownObjects` ×3,
`GalacticFeatures` ×1), plus 13 `vendor/motion-test-kit/*` files that error with "No test suite
found". Baseline before blaming yourself.
