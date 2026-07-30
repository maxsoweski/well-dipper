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

**STATUS 2026-07-30: the seam is built; the colour swap is BLOCKED on three findings. Read these
before attempting the port again — the naive version is a regression, and it was measured, not
guessed.**

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

### ⛔ Blocker A — `baseColor` and `surfacePaletteOf()` are NOT the same quantity

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

### ⛔ Blocker C — the game's bodies are barely differentiated in condition space

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
