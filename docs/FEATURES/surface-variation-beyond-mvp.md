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

Ground colour used to be one hard-coded constant — `uBaseColor = (0.46, 0.40, 0.34)`, assigned
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
  (`makeDummyCubeTexture()`, `planet-lod-lab.html` ~1506-1535).
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
> the LAB'S `main()`**, roughly `planet-lod-lab.html:350-700`, ~40 feature stages each with its own
> drivers. That chain is the actual slice-3 payload and it is what "still lab-only is the fragment body
> inside planet-lod-lab.html" means.

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
**auto-merge clean**; `planet-lod-lab.html` **conflicts**. Importing these modules from the game
without editing them adds ZERO new conflict surface — which is the reason to do slice 3 that way.

### 🔶 Recorded, NOT fixed — the honest palette flattens elevation banding on ~45% of bodies

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
  `vec3(0.6,0.58,0.55)` — shared by every planet in the game, the exact defect the lab retired for
  `uBaseColor`. They are now `uWeatheredColor` and `uFreshColor`; `midland` is `uSedColor`.
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
exactly as the lab does (the lab's ocean/ice/cloud layers are separate from `uBaseColor` too). The
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
`planet-lod-lab.html`**. Only booting the page found it.

Any GLSL or lab-wiring change is currently verified only by a human (or an agent) opening the page.
A minimal smoke test that boots the lab headlessly and asserts `window._lab` exists plus a clean
console would close a whole class of failure that is invisible today.

---

## Standing baseline

Full suite: **20684-20685 passed / 4 failed** (the passed count drifts by one run to run). The 4 are pre-existing (`KnownObjects` ×3,
`GalacticFeatures` ×1), plus 13 `vendor/motion-test-kit/*` files that error with "No test suite
found". Baseline before blaming yourself.
