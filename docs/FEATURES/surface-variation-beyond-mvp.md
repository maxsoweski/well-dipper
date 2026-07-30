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

### 1. Atmosphere from retention physics (the largest remaining gap)
`src/generation/PhysicsEngine.js` already has the whole chain — `computeAtmosphere()`,
`escapeVelocity()`, `jeansParameter()`, `exosphericTemperature()`, `equilibriumTemperature()`. The
lab imports **exactly one** function from that file (`generateRingPhysics`, for rings). Atmosphere is
currently faked by two hand-authored lookup tables keyed on the **preset's name**
(`LIMB_COLOR_BY_PRESET`, `TERM_COLOR_BY_PRESET` in `planet-lod-lab.html`) — the last name-keyed
lookup left in the colour path.

**Why cut:** `computeAtmosphere()` was written against the game's data shape, not the condition
vector, so it needs an adapter, and its outputs may not map cleanly onto the existing atmosphere
uniforms. Flagged from the start as the step most likely to be bigger than it looks.

**Worth knowing:** this is the one remaining item from Max's original "no variations in colour,
atmosphere, etc. wired in".

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

The port is the actual destination, so these matter more than the polish items above.

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

Full suite: **20684 passed / 4 failed**. The 4 are pre-existing (`KnownObjects` ×3,
`GalacticFeatures` ×1), plus 13 `vendor/motion-test-kit/*` files that error with "No test suite
found". Baseline before blaming yourself.
