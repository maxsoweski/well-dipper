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

- **False-renders (renders where `rendersOn` says it should not):** 109 (92 solid 🔴, 17 faint ⚠️)
- **Dead-renders (declared in `rendersOn` but inert):** 85
- **Degenerate frames (black / blown-out on a should-render cell):** 0

### 🔴 Solid false-renders — highest-priority (feature clearly paints a planet it should not)

| feature | renders on (unexpected) | Δ | declared `rendersOn` | divergent? |
|---|---|---:|---|:--:|
| `ecumenopolis` | **Frozen** | 0.0058 | Rocky, Ocean, Venus, Eye, Mars |  |
| `ecumenopolis` | **IceN** | 0.0058 | Rocky, Ocean, Venus, Eye, Mars |  |
| `ecumenopolis` | **GasJ** | 0.0058 | Rocky, Ocean, Venus, Eye, Mars |  |
| `ecumenopolis` | **Carbon** | 0.0058 | Rocky, Ocean, Venus, Eye, Mars |  |
| `ecumenopolis` | **Titan** | 0.0058 | Rocky, Ocean, Venus, Eye, Mars |  |
| `ecumenopolis` | **GasS** | 0.0058 | Rocky, Ocean, Venus, Eye, Mars |  |
| `ecumenopolis` | **HotJ** | 0.0058 | Rocky, Ocean, Venus, Eye, Mars |  |
| `ecumenopolis` | **Magma** | 0.0058 | Rocky, Ocean, Venus, Eye, Mars |  |
| `machine` | **GasS** | 0.0058 | Rocky |  |
| `machine` | **IceN** | 0.0058 | Rocky |  |
| `machine` | **SubN** | 0.0058 | Rocky |  |
| `machine` | **GasJ** | 0.0057 | Rocky |  |
| `machine` | **HotJ** | 0.0057 | Rocky |  |
| `ecumenopolis` | **Europa** | 0.0057 | Rocky, Ocean, Venus, Eye, Mars |  |
| `ecumenopolis` | **Cryst** | 0.0057 | Rocky, Ocean, Venus, Eye, Mars |  |
| `machine` | **Frozen** | 0.0057 | Rocky |  |
| `machine` | **Magma** | 0.0057 | Rocky |  |
| `machine` | **Titan** | 0.0056 | Rocky |  |
| `machine` | **Carbon** | 0.0056 | Rocky |  |
| `ecumenopolis` | **Lava** | 0.0056 | Rocky, Ocean, Venus, Eye, Mars |  |
| `machine` | **Lava** | 0.0056 | Rocky |  |
| `machine` | **Cryst** | 0.0056 | Rocky |  |
| `ecumenopolis` | **SubN** | 0.0056 | Rocky, Ocean, Venus, Eye, Mars |  |
| `machine` | **Europa** | 0.0055 | Rocky |  |
| `lava` | **Europa** | 0.0055 | Lava, Magma |  |
| `machine` | **Mars** | 0.0054 | Rocky |  |
| `frost` | **Europa** | 0.0054 | Titan, Frozen |  |
| `machine` | **Ocean** | 0.0053 | Rocky |  |
| `machine` | **Eye** | 0.0049 | Rocky |  |
| `machine` | **Venus** | 0.0045 | Rocky |  |
| `bioMats` | **Europa** | 0.0032 | Rocky, Ocean, Venus, Eye, Mars |  |
| `bioMats` | **Frozen** | 0.0032 | Rocky, Ocean, Venus, Eye, Mars |  |
| `bioMats` | **Cryst** | 0.0031 | Rocky, Ocean, Venus, Eye, Mars |  |
| `bioMats` | **Carbon** | 0.0031 | Rocky, Ocean, Venus, Eye, Mars |  |
| `bioMats` | **Lava** | 0.0030 | Rocky, Ocean, Venus, Eye, Mars |  |
| `bioMats` | **GasS** | 0.0030 | Rocky, Ocean, Venus, Eye, Mars |  |
| `bioMats` | **GasJ** | 0.0030 | Rocky, Ocean, Venus, Eye, Mars |  |
| `bioMats` | **HotJ** | 0.0030 | Rocky, Ocean, Venus, Eye, Mars |  |
| `bioMats` | **Titan** | 0.0030 | Rocky, Ocean, Venus, Eye, Mars |  |
| `bioMats` | **IceN** | 0.0030 | Rocky, Ocean, Venus, Eye, Mars |  |
| `bioMats` | **SubN** | 0.0030 | Rocky, Ocean, Venus, Eye, Mars |  |
| `bioMats` | **Magma** | 0.0030 | Rocky, Ocean, Venus, Eye, Mars |  |
| `mountains` | **Titan** | 0.0027 | Rocky, Ocean, Venus, Eye, Mars |  |
| `hexTess` | **Titan** | 0.0026 | Frozen | yes |
| `shatter` | **Rocky** | 0.0024 | Frozen |  |
| `hexTess` | **Europa** | 0.0024 | Frozen | yes |
| `shatter` | **Eye** | 0.0023 | Frozen |  |
| `hexTess` | **Cryst** | 0.0023 | Frozen | yes |
| `hexTess` | **Rocky** | 0.0023 | Frozen | yes |
| `shatter` | **Cryst** | 0.0023 | Frozen |  |
| `shatter` | **Europa** | 0.0023 | Frozen |  |
| `hexTess` | **Ocean** | 0.0023 | Frozen | yes |
| `hexTess` | **Eye** | 0.0022 | Frozen | yes |
| `weatherBands` | **Titan** | 0.0022 | Rocky, Ocean, Venus, Eye, Mars |  |
| `hexTess` | **Mars** | 0.0020 | Frozen | yes |
| `shatter` | **Mars** | 0.0019 | Frozen |  |
| `mountains` | **Frozen** | 0.0019 | Rocky, Ocean, Venus, Eye, Mars |  |
| `cityLights` | **Europa** | 0.0018 | Rocky, Ocean, Venus, Eye, Mars |  |
| `cityLights` | **Carbon** | 0.0018 | Rocky, Ocean, Venus, Eye, Mars |  |
| `cityLights` | **Cryst** | 0.0018 | Rocky, Ocean, Venus, Eye, Mars |  |
| `cityLights` | **Lava** | 0.0018 | Rocky, Ocean, Venus, Eye, Mars |  |
| `cityLights` | **Frozen** | 0.0018 | Rocky, Ocean, Venus, Eye, Mars |  |
| `cityLights` | **Magma** | 0.0018 | Rocky, Ocean, Venus, Eye, Mars |  |
| `mountains` | **Europa** | 0.0018 | Rocky, Ocean, Venus, Eye, Mars |  |
| `cityLights` | **GasJ** | 0.0018 | Rocky, Ocean, Venus, Eye, Mars |  |
| `cityLights` | **GasS** | 0.0018 | Rocky, Ocean, Venus, Eye, Mars |  |
| `cityLights` | **IceN** | 0.0018 | Rocky, Ocean, Venus, Eye, Mars |  |
| `cityLights` | **SubN** | 0.0018 | Rocky, Ocean, Venus, Eye, Mars |  |
| `cityLights` | **HotJ** | 0.0018 | Rocky, Ocean, Venus, Eye, Mars |  |
| `mountains` | **Cryst** | 0.0017 | Rocky, Ocean, Venus, Eye, Mars |  |
| `shatter` | **Ocean** | 0.0017 | Frozen |  |
| `glacial` | **Europa** | 0.0015 | Titan, Frozen |  |
| `shatter` | **Lava** | 0.0015 | Frozen |  |
| `shatter` | **Venus** | 0.0014 | Frozen |  |
| `hexTess` | **Venus** | 0.0013 | Frozen | yes |
| `hexTess` | **Lava** | 0.0013 | Frozen | yes |
| `shatter` | **Titan** | 0.0012 | Frozen |  |
| `sublimation` | **Europa** | 0.0012 | Titan, Frozen |  |
| `edifices` | **Europa** | 0.0010 | Lava, Magma |  |
| `mountains` | **Lava** | 0.0009 | Rocky, Ocean, Venus, Eye, Mars |  |
| `craters` | **Mars** | 0.0008 | Frozen |  |
| `hexTess` | **Carbon** | 0.0008 | Frozen | yes |
| `lava` | **Venus** | 0.0008 | Lava, Magma |  |
| `dust` | **SubN** | 0.0008 | Rocky, Ocean, Venus, Eye, Mars, Titan, Frozen |  |
| `dust` | **GasS** | 0.0008 | Rocky, Ocean, Venus, Eye, Mars, Titan, Frozen |  |
| `mountains` | **Carbon** | 0.0007 | Rocky, Ocean, Venus, Eye, Mars |  |
| `shatter` | **Carbon** | 0.0007 | Frozen |  |
| `dust` | **GasJ** | 0.0007 | Rocky, Ocean, Venus, Eye, Mars, Titan, Frozen |  |
| `massWasting` | **Cryst** | 0.0007 | Frozen, Rocky, Ocean, Venus, Eye, Mars, Lava, Magma, Europa, Titan |  |
| `dust` | **HotJ** | 0.0006 | Rocky, Ocean, Venus, Eye, Mars, Titan, Frozen |  |
| `tessera` | **Europa** | 0.0005 | Rocky, Ocean, Venus, Eye, Mars |  |
| `dust` | **IceN** | 0.0005 | Rocky, Ocean, Venus, Eye, Mars, Titan, Frozen |  |

### ⚠️ Faint false-renders — trace pixels (sub-0.0005; may be edge bleed or a real faint leak)

| feature | preset | Δ |
|---|---|---:|
| `craters` | Rocky | 0.00045 |
| `canyons` | Europa | 0.00045 |
| `canyons` | Lava | 0.00043 |
| `scarps` | Europa | 0.00036 |
| `sublimation` | Eye | 0.00028 |
| `glacial` | Eye | 0.00027 |
| `plateaus` | Europa | 0.00026 |
| `scarps` | Cryst | 0.00021 |
| `tessera` | Lava | 0.00021 |
| `edifices` | Venus | 0.00020 |
| `scarps` | Titan | 0.00017 |
| `craters` | Eye | 0.00015 |
| `glacial` | Ocean | 0.00015 |
| `edifices` | Eye | 0.00014 |
| `shatter` | Magma | 0.00013 |
| `craters` | Europa | 0.00012 |
| `edifices` | Rocky | 0.00011 |

### ⚠️ Dead-renders — declared but inert (manifest optimistic, kit insufficient, or driver gate broken)

| feature | preset (declared) | Δ | confidence |
|---|---|---:|---|
| `aurora` | Ocean | 0.00009 | measured inert |
| `aurora` | Titan | 0.00000 | measured inert |
| `aurora` | Venus | 0.00000 | measured inert |
| `aurora` | SubN | 0.00000 | measured inert |
| `aurora` | Eye | 0.00000 | measured inert |
| `aurora` | Mars | 0.00000 | measured inert |
| `canyons` | Ocean | 0.00008 | measured inert |
| `clouds` | Titan | 0.00001 | measured inert |
| `clouds` | Frozen | 0.00000 | measured inert |
| `clouds` | GasJ | 0.00001 | measured inert |
| `clouds` | GasS | 0.00001 | measured inert |
| `clouds` | IceN | 0.00001 | measured inert |
| `clouds` | HotJ | 0.00001 | measured inert |
| `clouds` | Mars | 0.00009 | measured inert |
| `coastlines` | Rocky | 0.00000 | measured inert |
| `coastlines` | Ocean | 0.00000 | measured inert |
| `coastlines` | Titan | 0.00006 | measured inert |
| `coastlines` | Frozen | 0.00000 | measured inert |
| `coastlines` | Venus | 0.00000 | measured inert |
| `coastlines` | Eye | 0.00000 | measured inert |
| `coastlines` | Mars | 0.00000 | measured inert |
| `deltas` | Rocky | 0.00004 | measured inert |
| `deltas` | Ocean | 0.00004 | measured inert |
| `deltas` | Titan | 0.00000 | measured inert |
| `deltas` | Frozen | 0.00000 | measured inert |
| `deltas` | Venus | 0.00000 | measured inert |
| `deltas` | Eye | 0.00006 | measured inert |
| `deltas` | Mars | 0.00000 | measured inert |
| `dunes` | Ocean | 0.00004 | measured inert |
| `dunes` | Titan | 0.00001 | measured inert |
| `dunes` | Frozen | 0.00000 | measured inert |
| `dunes` | Mars | 0.00000 | measured inert |
| `dust` | Frozen | 0.00000 | measured inert |
| `dust` | Mars | 0.00000 | measured inert |
| `edifices` | Magma | 0.00000 | measured inert |
| `greatSpot` | GasJ | 0.00001 | measured inert |
| `greatSpot` | GasS | 0.00002 | measured inert |
| `greatSpot` | IceN | 0.00001 | measured inert |
| `greatSpot` | SubN | 0.00001 | measured inert |
| `greatSpot` | HotJ | 0.00003 | measured inert |
| `jets` | IceN | 0.00003 | measured inert |
| `karst` | Titan | 0.00009 | measured inert |
| `karst` | Frozen | 0.00000 | measured inert |
| `lakes` | Frozen | 0.00000 | measured inert |
| `lakes` | Venus | 0.00000 | measured inert |
| `lakes` | Mars | 0.00000 | measured inert |
| `lightning` | GasJ | 0.00003 | LOW — sparse transient, likely instrument miss |
| `lightning` | GasS | 0.00005 | LOW — sparse transient, likely instrument miss |
| `lightning` | IceN | 0.00004 | LOW — sparse transient, likely instrument miss |
| `lightning` | Venus | 0.00003 | LOW — sparse transient, likely instrument miss |
| `lightning` | SubN | 0.00000 | LOW — sparse transient, likely instrument miss |
| `lightning` | HotJ | 0.00004 | LOW — sparse transient, likely instrument miss |
| `lightning` | Mars | 0.00002 | LOW — sparse transient, likely instrument miss |
| `massWasting` | Lava | 0.00004 | measured inert |
| `massWasting` | Titan | 0.00009 | measured inert |
| `massWasting` | Venus | 0.00009 | measured inert |
| `massWasting` | Magma | 0.00000 | measured inert |
| `outflow` | Titan | 0.00000 | measured inert |
| `outflow` | Frozen | 0.00000 | measured inert |
| `outflow` | Venus | 0.00000 | measured inert |
| `outflow` | Eye | 0.00000 | measured inert |
| `outflow` | Mars | 0.00009 | measured inert |
| `plateaus` | Ocean | 0.00006 | measured inert |
| `plateaus` | Mars | 0.00004 | measured inert |
| `polarVortex` | GasJ | 0.00000 | measured inert |
| `polarVortex` | GasS | 0.00000 | measured inert |
| `polarVortex` | IceN | 0.00000 | measured inert |
| `polarVortex` | SubN | 0.00000 | measured inert |
| `polarVortex` | HotJ | 0.00000 | measured inert |
| `rivers` | Frozen | 0.00000 | measured inert |
| `stormTrain` | GasJ | 0.00002 | measured inert |
| `stormTrain` | GasS | 0.00001 | measured inert |
| `stormTrain` | IceN | 0.00000 | measured inert |
| `stormTrain` | SubN | 0.00000 | measured inert |
| `stormTrain` | HotJ | 0.00000 | measured inert |
| `sublimation` | Titan | 0.00006 | measured inert |
| `sunglint` | Rocky | 0.00003 | measured inert |
| `sunglint` | Venus | 0.00000 | measured inert |
| `sunglint` | Eye | 0.00001 | measured inert |
| `sunglint` | Mars | 0.00000 | measured inert |
| `tessera` | Rocky | 0.00004 | measured inert |
| `tessera` | Eye | 0.00000 | measured inert |
| `tessera` | Mars | 0.00000 | measured inert |
| `weatherBands` | Venus | 0.00000 | measured inert |
| `weatherBands` | Mars | 0.00007 | measured inert |

## Render matrix by province group

Legend: ✅ renders-as-declared · `·` correctly inert · ⚠️D dead-render · 🔴F solid false-render · ⚠️F faint false-render. Columns are presets (codes below).

**Preset codes:** `Rocky`=Rocky (Earthlike) · `Lava`=Lava (hot airless) · `Ocean`=Ocean (temperate) · `Titan`=Titan (methane seas) · `Frozen`=Frozen (airless) · `Europa`=Europa (icy moon) · `GasJ`=Gas giant (Jovian) · `GasS`=Gas giant (Saturnian) · `IceN`=Ice giant (Neptunian) · `Venus`=Venus (sulfuric shroud) · `SubN`=Sub-Neptune (hazy) · `Eye`=Eyeball (locked temperate) · `HotJ`=Hot Jupiter (locked giant) · `Mars`=Mars (arid rocky) · `Magma`=Magma (K2-141b) · `Carbon`=Carbon (high C/O) · `Cryst`=Crystal (faceted)

### tectonic-highlands

| feature | Rocky | Lava | Ocean | Titan | Frozen | Europa | GasJ | GasS | IceN | Venus | SubN | Eye | HotJ | Mars | Magma | Carbon | Cryst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `canyons` | ✅ | ⚠️F | ⚠️D | · | · | ⚠️F | · | · | · | ✅ | · | ✅ | · | ✅ | · | · | · |
| `massWasting` | ✅ | ⚠️D | ✅ | ⚠️D | ✅ | ✅ | · | · | · | ⚠️D | · | ✅ | · | ✅ | ⚠️D | · | 🔴F |
| `mountains` | ✅ | 🔴F | ✅ | 🔴F | 🔴F | 🔴F | · | · | · | ✅ | · | ✅ | · | ✅ | · | 🔴F | 🔴F |
| `tessera` | ⚠️D | ⚠️F | ✅ | · | · | 🔴F | · | · | · | ✅ | · | ⚠️D | · | ⚠️D | · | · | · |

### old-plains

| feature | Rocky | Lava | Ocean | Titan | Frozen | Europa | GasJ | GasS | IceN | Venus | SubN | Eye | HotJ | Mars | Magma | Carbon | Cryst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `craters` | ⚠️F | · | · | · | ✅ | ⚠️F | · | · | · | · | · | ⚠️F | · | 🔴F | · | · | · |
| `dunes` | ✅ | · | ⚠️D | ⚠️D | ⚠️D | · | · | · | · | ✅ | · | ✅ | · | ⚠️D | · | · | · |
| `dust` | ✅ | · | ✅ | ✅ | ⚠️D | · | 🔴F | 🔴F | 🔴F | ✅ | 🔴F | ✅ | 🔴F | ⚠️D | · | · | · |
| `ejecta` | · | · | · | · | ✅ | · | · | · | · | · | · | · | · | · | · | · | · |

### volcanic-provinces

| feature | Rocky | Lava | Ocean | Titan | Frozen | Europa | GasJ | GasS | IceN | Venus | SubN | Eye | HotJ | Mars | Magma | Carbon | Cryst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `chaos` | · | · | · | · | · | ✅ | · | · | · | · | · | · | · | · | · | · | · |
| `edifices` | ⚠️F | ✅ | · | · | · | 🔴F | · | · | · | ⚠️F | · | ⚠️F | · | · | ⚠️D | · | · |
| `karst` | ✅ | · | ✅ | ⚠️D | ⚠️D | · | · | · | · | ✅ | · | ✅ | · | ✅ | · | · | · |
| `lava` | · | ✅ | · | · | · | 🔴F | · | · | · | 🔴F | · | · | · | · | ✅ | · | · |

### anti-volcanic

| feature | Rocky | Lava | Ocean | Titan | Frozen | Europa | GasJ | GasS | IceN | Venus | SubN | Eye | HotJ | Mars | Magma | Carbon | Cryst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `cryoRidge` | · | · | · | · | · | ✅ | · | · | · | · | · | · | · | · | · | · | · |

### ancient-high

| feature | Rocky | Lava | Ocean | Titan | Frozen | Europa | GasJ | GasS | IceN | Venus | SubN | Eye | HotJ | Mars | Magma | Carbon | Cryst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `plateaus` | ✅ | · | ⚠️D | · | · | ⚠️F | · | · | · | ✅ | · | ✅ | · | ⚠️D | · | · | · |
| `scarps` | ✅ | · | ✅ | ⚠️F | ✅ | ⚠️F | · | · | · | ✅ | · | ✅ | · | ✅ | · | · | ⚠️F |
| `sublimation` | · | · | · | ⚠️D | ✅ | 🔴F | · | · | · | · | · | ⚠️F | · | · | · | · | · |

### young-lowlands

| feature | Rocky | Lava | Ocean | Titan | Frozen | Europa | GasJ | GasS | IceN | Venus | SubN | Eye | HotJ | Mars | Magma | Carbon | Cryst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `deltas` | ⚠️D | · | ⚠️D | ⚠️D | ⚠️D | · | · | · | · | ⚠️D | · | ⚠️D | · | ⚠️D | · | · | · |
| `glacial` | · | · | ⚠️F | ✅ | ✅ | 🔴F | · | · | · | · | · | ⚠️F | · | · | · | · | · |
| `outflow` | ✅ | · | ✅ | ⚠️D | ⚠️D | · | · | · | · | ⚠️D | · | ⚠️D | · | ⚠️D | · | · | · |
| `rivers` | ✅ | · | ✅ | ✅ | ⚠️D | · | · | · | · | ✅ | · | ✅ | · | ✅ | · | · | · |

### global

| feature | Rocky | Lava | Ocean | Titan | Frozen | Europa | GasJ | GasS | IceN | Venus | SubN | Eye | HotJ | Mars | Magma | Carbon | Cryst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `aurora` | ✅ | · | ⚠️D | ⚠️D | · | · | ✅ | ✅ | ✅ | ⚠️D | ⚠️D | ⚠️D | ✅ | ⚠️D | · | · | · |
| `bands` | · | · | · | · | · | · | ✅ | ✅ | ✅ | · | ✅ | · | ✅ | · | · | · | · |
| `bioMats` | ✅ | 🔴F | ✅ | 🔴F | 🔴F | 🔴F | 🔴F | 🔴F | 🔴F | ✅ | 🔴F | ✅ | 🔴F | ✅ | 🔴F | 🔴F | 🔴F |
| `carbon` | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✅ | · |
| `cityLights` | ✅ | 🔴F | ✅ | · | 🔴F | 🔴F | 🔴F | 🔴F | 🔴F | ✅ | 🔴F | ✅ | 🔴F | ✅ | 🔴F | 🔴F | 🔴F |
| `clouds` | ✅ | · | ✅ | ⚠️D | ⚠️D | · | ⚠️D | ⚠️D | ⚠️D | ✅ | ✅ | ✅ | ⚠️D | ⚠️D | · | · | · |
| `coastlines` | ⚠️D | · | ⚠️D | ⚠️D | ⚠️D | · | · | · | · | ⚠️D | · | ⚠️D | · | ⚠️D | · | · | · |
| `daysideThermal` | · | · | · | · | · | · | · | · | · | · | · | · | ✅ | · | · | · | · |
| `dustStorm` | · | · | · | · | · | · | · | · | · | · | · | · | · | ✅ | · | · | · |
| `ecumenopolis` | ✅ | 🔴F | ✅ | 🔴F | 🔴F | 🔴F | 🔴F | 🔴F | 🔴F | ✅ | 🔴F | ✅ | 🔴F | ✅ | 🔴F | 🔴F | 🔴F |
| `facets` | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✅ |
| `frost` | · | · | · | ✅ | ✅ | 🔴F | · | · | · | · | · | · | · | · | · | · | · |
| `greatSpot` | · | · | · | · | · | · | ⚠️D | ⚠️D | ⚠️D | · | ⚠️D | · | ⚠️D | · | · | · | · |
| `hexTess` | 🔴F | 🔴F | 🔴F | 🔴F | ✅ | 🔴F | · | · | · | 🔴F | · | 🔴F | · | 🔴F | · | 🔴F | 🔴F |
| `jets` | · | · | · | · | · | · | ✅ | ✅ | ⚠️D | · | ✅ | · | ✅ | · | · | · | · |
| `lakes` | ✅ | · | ✅ | ✅ | ⚠️D | · | · | · | · | ⚠️D | · | ✅ | · | ⚠️D | · | · | · |
| `lightning` | ✅ | · | ✅ | · | · | · | ⚠️D | ⚠️D | ⚠️D | ⚠️D | ⚠️D | ✅ | ⚠️D | ⚠️D | · | · | · |
| `limb` | ✅ | · | ✅ | ✅ | · | · | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | · | · | · |
| `machine` | ✅ | 🔴F | 🔴F | 🔴F | 🔴F | 🔴F | 🔴F | 🔴F | 🔴F | 🔴F | 🔴F | 🔴F | 🔴F | 🔴F | 🔴F | 🔴F | 🔴F |
| `magma` | · | ✅ | · | · | · | · | · | · | · | · | · | · | · | · | ✅ | · | · |
| `nightsideThermal` | · | · | · | · | · | · | · | · | · | · | · | · | ✅ | · | · | · | · |
| `polarVortex` | · | · | · | · | · | · | ⚠️D | ⚠️D | ⚠️D | · | ⚠️D | · | ⚠️D | · | · | · | · |
| `shatter` | 🔴F | 🔴F | 🔴F | 🔴F | ✅ | 🔴F | · | · | · | 🔴F | · | 🔴F | · | 🔴F | ⚠️F | 🔴F | 🔴F |
| `stormTrain` | · | · | · | · | · | · | ⚠️D | ⚠️D | ⚠️D | · | ⚠️D | · | ⚠️D | · | · | · | · |
| `sunglint` | ⚠️D | · | ✅ | ✅ | · | · | · | · | · | ⚠️D | · | ⚠️D | · | ⚠️D | · | · | · |
| `terminator` | ✅ | · | ✅ | ✅ | · | · | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | · | · | · |
| `weatherBands` | ✅ | · | ✅ | 🔴F | · | · | · | · | · | ⚠️D | · | ✅ | · | ⚠️D | · | · | · |

---

*Raw deltas: `docs/FEATURES/.sweep-raw.json`. Auditor: `lab-render-audit.js` (`tests/render-audit.test.js`). Sweep harness: `window._lab.renderDeltaSweep()` in `planet-lod-lab.html`.*
