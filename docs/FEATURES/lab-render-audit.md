# Lab render-audit — Tier-2 correspondence gate (Phase 2.5)

> **Generated** by `scripts/gen-render-audit.mjs` from a live GPU render-delta sweep
> (`window._lab.renderDeltaSweep()` over all 17 `DRIVER_PRESETS`, chrome-devtools on the
> RTX-5080 `:9223` Chrome). Each cell is a feature's **player-visible marginal contribution**
> on a preset, measured as an A/B pixel delta on the low-res `sceneTarget`.

## How each cell is measured (read this before triaging)

**Baseline = the preset's NATURAL planet, not a bare solo.** For each (preset, feature):
`ON = relevantFeatureSet(preset) ∪ {feature}`, `OFF = relevantFeatureSet(preset) \ {feature}`.
The delta is the **fraction of frame pixels that differ by >12/255 summed-abs RGB** between
ON and OFF. This answers the question the audit actually cares about — *"does toggling this
feature change the planet the player sees on this preset?"* — so a surface feature hidden
under a gas giant's atmosphere correctly reads as **not rendering** (≈0 delta).

> **Methodology note (decided this session, diverges from the literal plan).** The plan's
> Phase-2.5 spec said "in-context solo (`{feature} ∪ isolationKit`) ON vs OFF". Implementing it
> revealed that soloing a surface feature *strips the preset's own atmosphere/bands*, exposing a
> bare terrain sphere the feature obviously paints — measuring **capability** (can it paint the
> geometry?) rather than **visibility** (does the player see it?). That inflated false-renders to
> 185, dominated by "mountains/hexTess render on a stripped gas giant" — not the bug Max is
> hunting. The natural-baseline above measures visibility instead. **The raw solo+kit capability
> data is still in `.sweep-raw.json` history if a capability lens is wanted; this report is the
> visibility lens.** `isolationKit` (audit Decision 3) is therefore NOT exercised by this sweep —
> the natural set supersedes it. Flag for Max if the capability lens is also wanted.

**Sampling:** each A/B pair is captured at **2 camera hemispheres** (yaw + 0 and + π — night-side
features like aurora / cityLights / lightning live on the unlit side) × **3 `uTime` instants**
(0, 12, 24 — across a clouds/aurora cycle so animated features register). A pixel counts if ON/OFF
differ at **any** of the 6 samples. Auto-spin is frozen and ON/OFF share each instant, so an inert
feature changes **exactly 0** pixels — the noise floor is genuinely zero.

> **Thresholds:** render/inert boundary `eps = 0.0001` (≈14px of ≈141k frame px);
> a false-render above `0.0005` is 🔴 "solid", below is ⚠️ "faint trace".

## ⚠️ Known instrument limits (affect confidence, not yet triaged out)

- **Sparse transients (`lightning`) are LOW-CONFIDENCE.** Lightning is a brief, jittered flash;
  3 time-samples can land entirely between flashes, so its **dead-renders are likely instrument
  misses, not real bugs.** Treat `lightning` dead-renders as "unconfirmed" pending a denser
  time-sweep. Same caution, lesser degree, for other sparse storm transients.
- **Very small footprints** near the eps floor (faint ⚠️ tier) may be edge-bleed from a neighboring
  feature toggling, not the feature itself — verify the faint tier by eye before acting.
- This is a **mechanical** gate (does it paint / where). Aesthetic "looks broken" beyond all-black /
  blown-out stays Max's review-lap call.

**This report is the deliverable. Fixing the violations is follow-on, triaged with Max** —
each one disambiguates *manifest wrong* (`rendersOn` needs this preset) vs *feature buggy*
(driver gate in `applyDrivers()`/`deriveUniforms()` derives nonzero where it should not).

## ⚠️ Violations punch-list

- **False-renders (renders where `rendersOn` says it should not):** 64 (57 solid 🔴, 7 faint ⚠️)
- **Dead-renders (declared in `rendersOn` but inert):** 51
- **Degenerate frames (black / blown-out on a should-render cell):** 0

### 🔴 Solid false-renders — highest-priority (feature clearly paints a planet it should not)

| feature | renders on (unexpected) | Δ | declared `rendersOn` | divergent? |
|---|---|---:|---|:--:|
| `machine` | **Ocean** | 0.3771 | Rocky |  |
| `machine` | **Eye** | 0.3376 | Rocky |  |
| `hexTess` | **Mars** | 0.1970 | Frozen | yes |
| `hexTess` | **Ocean** | 0.1871 | Frozen | yes |
| `hexTess` | **Cryst** | 0.1849 | Frozen | yes |
| `shatter` | **Rocky** | 0.1819 | Frozen |  |
| `hexTess` | **Titan** | 0.1818 | Frozen | yes |
| `hexTess` | **Europa** | 0.1743 | Frozen | yes |
| `hexTess` | **Rocky** | 0.1734 | Frozen | yes |
| `shatter` | **Mars** | 0.1731 | Frozen |  |
| `frost` | **Mars** | 0.1683 | Titan, Frozen, Europa |  |
| `shatter` | **Europa** | 0.1678 | Frozen |  |
| `shatter` | **Ocean** | 0.1667 | Frozen |  |
| `shatter` | **Eye** | 0.1649 | Frozen |  |
| `shatter` | **Cryst** | 0.1640 | Frozen |  |
| `hexTess` | **Eye** | 0.1587 | Frozen | yes |
| `shatter` | **Titan** | 0.1048 | Frozen |  |
| `hexTess` | **Lava** | 0.1009 | Frozen | yes |
| `shatter` | **Lava** | 0.0876 | Frozen |  |
| `mountains` | **Cryst** | 0.0853 | Rocky, Ocean, Venus, Eye, Mars, Lava |  |
| `hexTess` | **Carbon** | 0.0775 | Frozen | yes |
| `mountains` | **Carbon** | 0.0763 | Rocky, Ocean, Venus, Eye, Mars, Lava |  |
| `shatter` | **Carbon** | 0.0620 | Frozen |  |
| `hexTess` | **Venus** | 0.0568 | Frozen | yes |
| `shatter` | **Venus** | 0.0533 | Frozen |  |
| `canyons` | **Europa** | 0.0362 | Rocky, Ocean, Venus, Eye, Mars |  |
| `canyons` | **Lava** | 0.0318 | Rocky, Ocean, Venus, Eye, Mars |  |
| `scarps` | **Europa** | 0.0296 | Frozen, Rocky, Ocean, Venus, Eye, Mars |  |
| `plateaus` | **Europa** | 0.0255 | Rocky, Ocean, Venus, Eye, Mars |  |
| `sublimation` | **Eye** | 0.0213 | Titan, Frozen, Europa |  |
| `scarps` | **Cryst** | 0.0207 | Frozen, Rocky, Ocean, Venus, Eye, Mars |  |
| `glacial` | **Eye** | 0.0198 | Titan, Frozen, Europa |  |
| `glacial` | **Ocean** | 0.0184 | Titan, Frozen, Europa |  |
| `tessera` | **Lava** | 0.0160 | Rocky, Ocean, Venus, Eye, Mars |  |
| `plateaus` | **Lava** | 0.0105 | Rocky, Ocean, Venus, Eye, Mars |  |
| `craters` | **Ocean** | 0.0097 | Frozen, Mars, Rocky, Eye |  |
| `craters` | **Europa** | 0.0083 | Frozen, Mars, Rocky, Eye |  |
| `lightning` | **Titan** | 0.0082 | GasJ, GasS, IceN, SubN, Rocky, Ocean, Venus, Eye, Mars, HotJ |  |
| `scarps` | **Lava** | 0.0081 | Frozen, Rocky, Ocean, Venus, Eye, Mars |  |
| `sublimation` | **Mars** | 0.0080 | Titan, Frozen, Europa |  |
| `scarps` | **Titan** | 0.0078 | Frozen, Rocky, Ocean, Venus, Eye, Mars |  |
| `shatter` | **Magma** | 0.0073 | Frozen |  |
| `canyons` | **Frozen** | 0.0072 | Rocky, Ocean, Venus, Eye, Mars |  |
| `edifices` | **Eye** | 0.0071 | Lava, Magma, Venus |  |
| `craters` | **Carbon** | 0.0065 | Frozen, Mars, Rocky, Eye |  |
| `edifices` | **Ocean** | 0.0056 | Lava, Magma, Venus |  |
| `edifices` | **Rocky** | 0.0055 | Lava, Magma, Venus |  |
| `craters` | **Cryst** | 0.0054 | Frozen, Mars, Rocky, Eye |  |
| `edifices` | **Mars** | 0.0051 | Lava, Magma, Venus |  |
| `ejecta` | **Ocean** | 0.0044 | Frozen, Mars, Rocky, Eye |  |
| `hexTess` | **Magma** | 0.0035 | Frozen | yes |
| `scarps` | **Carbon** | 0.0035 | Frozen, Rocky, Ocean, Venus, Eye, Mars |  |
| `plateaus` | **Frozen** | 0.0031 | Rocky, Ocean, Venus, Eye, Mars |  |
| `mountains` | **Magma** | 0.0024 | Rocky, Ocean, Venus, Eye, Mars, Lava |  |
| `craters` | **Titan** | 0.0013 | Frozen, Mars, Rocky, Eye |  |
| `canyons` | **Magma** | 0.0009 | Rocky, Ocean, Venus, Eye, Mars |  |
| `craters` | **Venus** | 0.0006 | Frozen, Mars, Rocky, Eye |  |

### ⚠️ Faint false-renders — trace pixels (sub-0.0005; may be edge bleed or a real faint leak)

| feature | preset | Δ |
|---|---|---:|
| `tessera` | Magma | 0.00044 |
| `plateaus` | Titan | 0.00036 |
| `plateaus` | Carbon | 0.00030 |
| `canyons` | Carbon | 0.00026 |
| `canyons` | Titan | 0.00017 |
| `ejecta` | Venus | 0.00014 |
| `plateaus` | Magma | 0.00012 |

### ⚠️ Dead-renders — declared but inert (manifest optimistic, kit insufficient, or driver gate broken)

| feature | preset (declared) | Δ | confidence |
|---|---|---:|---|
| `aurora` | Titan | 0.00000 | measured inert |
| `aurora` | Venus | 0.00000 | measured inert |
| `aurora` | SubN | 0.00000 | measured inert |
| `aurora` | Eye | 0.00000 | measured inert |
| `aurora` | Mars | 0.00000 | measured inert |
| `bioMats` | Venus | 0.00000 | measured inert |
| `bioMats` | Mars | 0.00000 | measured inert |
| `cityLights` | Venus | 0.00000 | measured inert |
| `cityLights` | Mars | 0.00000 | measured inert |
| `clouds` | Frozen | 0.00000 | measured inert |
| `coastlines` | Rocky | 0.00000 | measured inert |
| `coastlines` | Ocean | 0.00000 | measured inert |
| `coastlines` | Frozen | 0.00000 | measured inert |
| `coastlines` | Venus | 0.00000 | measured inert |
| `coastlines` | Eye | 0.00000 | measured inert |
| `coastlines` | Mars | 0.00000 | measured inert |
| `deltas` | Frozen | 0.00000 | measured inert |
| `deltas` | Venus | 0.00001 | measured inert |
| `dunes` | Frozen | 0.00000 | measured inert |
| `dunes` | Mars | 0.00000 | measured inert |
| `dust` | Frozen | 0.00000 | measured inert |
| `dust` | Mars | 0.00000 | measured inert |
| `ecumenopolis` | Venus | 0.00000 | measured inert |
| `ecumenopolis` | Mars | 0.00000 | measured inert |
| `greatSpot` | SubN | 0.00005 | measured inert |
| `karst` | Frozen | 0.00000 | measured inert |
| `lakes` | Frozen | 0.00000 | measured inert |
| `lakes` | Venus | 0.00000 | measured inert |
| `lakes` | Mars | 0.00000 | measured inert |
| `lightning` | SubN | 0.00000 | LOW — sparse transient, likely instrument miss |
| `massWasting` | Magma | 0.00009 | measured inert |
| `massWasting` | Carbon | 0.00000 | measured inert |
| `outflow` | Titan | 0.00000 | measured inert |
| `outflow` | Frozen | 0.00000 | measured inert |
| `outflow` | Venus | 0.00000 | measured inert |
| `outflow` | Eye | 0.00000 | measured inert |
| `polarVortex` | GasJ | 0.00000 | measured inert |
| `polarVortex` | GasS | 0.00000 | measured inert |
| `polarVortex` | IceN | 0.00000 | measured inert |
| `polarVortex` | SubN | 0.00000 | measured inert |
| `polarVortex` | HotJ | 0.00000 | measured inert |
| `rivers` | Frozen | 0.00000 | measured inert |
| `stormTrain` | IceN | 0.00000 | measured inert |
| `stormTrain` | SubN | 0.00000 | measured inert |
| `stormTrain` | HotJ | 0.00000 | measured inert |
| `sunglint` | Venus | 0.00000 | measured inert |
| `sunglint` | Eye | 0.00002 | measured inert |
| `sunglint` | Mars | 0.00000 | measured inert |
| `tessera` | Eye | 0.00000 | measured inert |
| `tessera` | Mars | 0.00000 | measured inert |
| `weatherBands` | Venus | 0.00000 | measured inert |

## Render matrix by province group

Legend: ✅ renders-as-declared · `·` correctly inert · ⚠️D dead-render · 🔴F solid false-render · ⚠️F faint false-render. Columns are presets (codes below).

**Preset codes:** `Rocky`=Rocky (Earthlike) · `Lava`=Lava (hot airless) · `Ocean`=Ocean (temperate) · `Titan`=Titan (methane seas) · `Frozen`=Frozen (airless) · `Europa`=Europa (icy moon) · `GasJ`=Gas giant (Jovian) · `GasS`=Gas giant (Saturnian) · `IceN`=Ice giant (Neptunian) · `Venus`=Venus (sulfuric shroud) · `SubN`=Sub-Neptune (hazy) · `Eye`=Eyeball (locked temperate) · `HotJ`=Hot Jupiter (locked giant) · `Mars`=Mars (arid rocky) · `Magma`=Magma (K2-141b) · `Carbon`=Carbon (high C/O) · `Cryst`=Crystal (faceted)

### tectonic-highlands

| feature | Rocky | Lava | Ocean | Titan | Frozen | Europa | GasJ | GasS | IceN | Venus | SubN | Eye | HotJ | Mars | Magma | Carbon | Cryst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `canyons` | ✅ | 🔴F | ✅ | ⚠️F | 🔴F | 🔴F | · | · | · | ✅ | · | ✅ | · | ✅ | 🔴F | ⚠️F | · |
| `massWasting` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | · | · | · | ✅ | · | ✅ | · | ✅ | ⚠️D | ⚠️D | ✅ |
| `mountains` | ✅ | ✅ | ✅ | · | · | · | · | · | · | ✅ | · | ✅ | · | ✅ | 🔴F | 🔴F | 🔴F |
| `tessera` | ✅ | 🔴F | ✅ | · | · | · | · | · | · | ✅ | · | ⚠️D | · | ⚠️D | ⚠️F | · | · |

### old-plains

| feature | Rocky | Lava | Ocean | Titan | Frozen | Europa | GasJ | GasS | IceN | Venus | SubN | Eye | HotJ | Mars | Magma | Carbon | Cryst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `craters` | ✅ | · | 🔴F | 🔴F | ✅ | 🔴F | · | · | · | 🔴F | · | ✅ | · | ✅ | · | 🔴F | 🔴F |
| `dunes` | ✅ | · | ✅ | ✅ | ⚠️D | · | · | · | · | ✅ | · | ✅ | · | ⚠️D | · | · | · |
| `dust` | ✅ | · | ✅ | ✅ | ⚠️D | · | · | · | · | ✅ | · | ✅ | · | ⚠️D | · | · | · |
| `ejecta` | ✅ | · | 🔴F | · | ✅ | · | · | · | · | ⚠️F | · | ✅ | · | ✅ | · | · | · |

### volcanic-provinces

| feature | Rocky | Lava | Ocean | Titan | Frozen | Europa | GasJ | GasS | IceN | Venus | SubN | Eye | HotJ | Mars | Magma | Carbon | Cryst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `chaos` | · | · | · | · | · | ✅ | · | · | · | · | · | · | · | · | · | · | · |
| `edifices` | 🔴F | ✅ | 🔴F | · | · | · | · | · | · | ✅ | · | 🔴F | · | 🔴F | ✅ | · | · |
| `karst` | ✅ | · | ✅ | ✅ | ⚠️D | · | · | · | · | ✅ | · | ✅ | · | ✅ | · | · | · |
| `lava` | · | ✅ | · | · | · | · | · | · | · | ✅ | · | · | · | · | ✅ | · | · |

### anti-volcanic

| feature | Rocky | Lava | Ocean | Titan | Frozen | Europa | GasJ | GasS | IceN | Venus | SubN | Eye | HotJ | Mars | Magma | Carbon | Cryst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `cryoRidge` | · | · | · | · | · | ✅ | · | · | · | · | · | · | · | · | · | · | · |

### ancient-high

| feature | Rocky | Lava | Ocean | Titan | Frozen | Europa | GasJ | GasS | IceN | Venus | SubN | Eye | HotJ | Mars | Magma | Carbon | Cryst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `plateaus` | ✅ | 🔴F | ✅ | ⚠️F | 🔴F | 🔴F | · | · | · | ✅ | · | ✅ | · | ✅ | ⚠️F | ⚠️F | · |
| `scarps` | ✅ | 🔴F | ✅ | 🔴F | ✅ | 🔴F | · | · | · | ✅ | · | ✅ | · | ✅ | · | 🔴F | 🔴F |
| `sublimation` | · | · | · | ✅ | ✅ | ✅ | · | · | · | · | · | 🔴F | · | 🔴F | · | · | · |

### young-lowlands

| feature | Rocky | Lava | Ocean | Titan | Frozen | Europa | GasJ | GasS | IceN | Venus | SubN | Eye | HotJ | Mars | Magma | Carbon | Cryst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `deltas` | ✅ | · | ✅ | ✅ | ⚠️D | · | · | · | · | ⚠️D | · | ✅ | · | ✅ | · | · | · |
| `glacial` | · | · | 🔴F | ✅ | ✅ | ✅ | · | · | · | · | · | 🔴F | · | · | · | · | · |
| `outflow` | ✅ | · | ✅ | ⚠️D | ⚠️D | · | · | · | · | ⚠️D | · | ⚠️D | · | ✅ | · | · | · |
| `rivers` | ✅ | · | ✅ | ✅ | ⚠️D | · | · | · | · | ✅ | · | ✅ | · | ✅ | · | · | · |

### global

| feature | Rocky | Lava | Ocean | Titan | Frozen | Europa | GasJ | GasS | IceN | Venus | SubN | Eye | HotJ | Mars | Magma | Carbon | Cryst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `aurora` | ✅ | · | ✅ | ⚠️D | · | · | ✅ | ✅ | ✅ | ⚠️D | ⚠️D | ⚠️D | ✅ | ⚠️D | · | · | · |
| `bands` | · | · | · | · | · | · | ✅ | ✅ | ✅ | · | ✅ | · | ✅ | · | · | · | · |
| `bioMats` | ✅ | · | ✅ | · | · | · | · | · | · | ⚠️D | · | ✅ | · | ⚠️D | · | · | · |
| `carbon` | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✅ | · |
| `cityLights` | ✅ | · | ✅ | · | · | · | · | · | · | ⚠️D | · | ✅ | · | ⚠️D | · | · | · |
| `clouds` | ✅ | · | ✅ | ✅ | ⚠️D | · | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | · | · | · |
| `coastlines` | ⚠️D | · | ⚠️D | ✅ | ⚠️D | · | · | · | · | ⚠️D | · | ⚠️D | · | ⚠️D | · | · | · |
| `daysideThermal` | · | · | · | · | · | · | · | · | · | · | · | · | ✅ | · | · | · | · |
| `dustStorm` | · | · | · | · | · | · | · | · | · | · | · | · | · | ✅ | · | · | · |
| `ecumenopolis` | ✅ | · | ✅ | · | · | · | · | · | · | ⚠️D | · | ✅ | · | ⚠️D | · | · | · |
| `facets` | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✅ |
| `frost` | · | · | · | ✅ | ✅ | ✅ | · | · | · | · | · | · | · | 🔴F | · | · | · |
| `greatSpot` | · | · | · | · | · | · | ✅ | ✅ | ✅ | · | ⚠️D | · | ✅ | · | · | · | · |
| `hexTess` | 🔴F | 🔴F | 🔴F | 🔴F | ✅ | 🔴F | · | · | · | 🔴F | · | 🔴F | · | 🔴F | 🔴F | 🔴F | 🔴F |
| `jets` | · | · | · | · | · | · | ✅ | ✅ | ✅ | · | ✅ | · | ✅ | · | · | · | · |
| `lakes` | ✅ | · | ✅ | ✅ | ⚠️D | · | · | · | · | ⚠️D | · | ✅ | · | ⚠️D | · | · | · |
| `lightning` | ✅ | · | ✅ | 🔴F | · | · | ✅ | ✅ | ✅ | ✅ | ⚠️D | ✅ | ✅ | ✅ | · | · | · |
| `limb` | ✅ | · | ✅ | ✅ | · | · | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | · | · | · |
| `machine` | ✅ | · | 🔴F | · | · | · | · | · | · | · | · | 🔴F | · | · | · | · | · |
| `magma` | · | ✅ | · | · | · | · | · | · | · | · | · | · | · | · | ✅ | · | · |
| `nightsideThermal` | · | · | · | · | · | · | · | · | · | · | · | · | ✅ | · | · | · | · |
| `polarVortex` | · | · | · | · | · | · | ⚠️D | ⚠️D | ⚠️D | · | ⚠️D | · | ⚠️D | · | · | · | · |
| `shatter` | 🔴F | 🔴F | 🔴F | 🔴F | ✅ | 🔴F | · | · | · | 🔴F | · | 🔴F | · | 🔴F | 🔴F | 🔴F | 🔴F |
| `stormTrain` | · | · | · | · | · | · | ✅ | ✅ | ⚠️D | · | ⚠️D | · | ⚠️D | · | · | · | · |
| `sunglint` | ✅ | · | ✅ | ✅ | · | · | · | · | · | ⚠️D | · | ⚠️D | · | ⚠️D | · | · | · |
| `terminator` | ✅ | · | ✅ | ✅ | · | · | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | · | · | · |
| `weatherBands` | ✅ | · | ✅ | · | · | · | · | · | · | ⚠️D | · | ✅ | · | ✅ | · | · | · |

---

*Raw deltas: `docs/FEATURES/.sweep-raw.json`. Auditor: `lab-render-audit.js` (`tests/render-audit.test.js`). Sweep harness: `window._lab.renderDeltaSweep()` in `planet-lod-lab.html`.*
