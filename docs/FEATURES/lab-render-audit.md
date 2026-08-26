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

- **False-renders (renders where `rendersOn` says it should not):** 2 (2 solid 🔴, 0 faint ⚠️)
- **Dead-renders (declared in `rendersOn` but inert):** 63
- **Degenerate frames (black / blown-out on a should-render cell):** 0

### 🔴 Solid false-renders — highest-priority (feature clearly paints a planet it should not)

| feature | renders on (unexpected) | Δ | declared `rendersOn` | divergent? |
|---|---|---:|---|:--:|
| `lightning` | **Titan** | 0.0107 | GasJ, GasS, IceN, SubN, Rocky, Ocean, Venus, Eye, Mars, HotJ |  |
| `magma` | **Ocean** | 0.0036 | Magma, Lava |  |

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
| `clouds` | Titan | 0.00005 | measured inert |
| `clouds` | Frozen | 0.00000 | measured inert |
| `clouds` | GasJ | 0.00001 | measured inert |
| `clouds` | GasS | 0.00001 | measured inert |
| `clouds` | IceN | 0.00001 | measured inert |
| `clouds` | HotJ | 0.00001 | measured inert |
| `coastlines` | Rocky | 0.00000 | measured inert |
| `coastlines` | Ocean | 0.00000 | measured inert |
| `coastlines` | Frozen | 0.00000 | measured inert |
| `coastlines` | Venus | 0.00000 | measured inert |
| `coastlines` | Eye | 0.00000 | measured inert |
| `coastlines` | Mars | 0.00000 | measured inert |
| `deltas` | Frozen | 0.00000 | measured inert |
| `deltas` | Venus | 0.00002 | measured inert |
| `dunes` | Frozen | 0.00000 | measured inert |
| `dunes` | Mars | 0.00000 | measured inert |
| `dust` | Frozen | 0.00000 | measured inert |
| `dust` | Mars | 0.00000 | measured inert |
| `ecumenopolis` | Venus | 0.00000 | measured inert |
| `ecumenopolis` | Mars | 0.00000 | measured inert |
| `ejecta` | Venus | 0.00010 | measured inert |
| `glacial` | Mars | 0.00000 | measured inert |
| `greatSpot` | GasJ | 0.00002 | measured inert |
| `greatSpot` | GasS | 0.00002 | measured inert |
| `greatSpot` | IceN | 0.00002 | measured inert |
| `greatSpot` | SubN | 0.00000 | measured inert |
| `greatSpot` | HotJ | 0.00000 | measured inert |
| `karst` | Frozen | 0.00000 | measured inert |
| `lakes` | Frozen | 0.00000 | measured inert |
| `lakes` | Venus | 0.00000 | measured inert |
| `lakes` | Mars | 0.00000 | measured inert |
| `lightning` | SubN | 0.00000 | LOW — sparse transient, likely instrument miss |
| `massWasting` | Magma | 0.00000 | measured inert |
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
| `stormTrain` | GasS | 0.00008 | measured inert |
| `stormTrain` | IceN | 0.00000 | measured inert |
| `stormTrain` | SubN | 0.00000 | measured inert |
| `stormTrain` | HotJ | 0.00000 | measured inert |
| `sunglint` | Venus | 0.00000 | measured inert |
| `sunglint` | Eye | 0.00005 | measured inert |
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
| `canyons` | ✅ | ✅ | ✅ | · | · | · | · | · | · | ✅ | · | ✅ | · | ✅ | · | · | · |
| `massWasting` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | · | · | · | ✅ | · | ✅ | · | ✅ | ⚠️D | ⚠️D | ✅ |
| `mountains` | ✅ | ✅ | ✅ | · | · | · | · | · | · | ✅ | · | ✅ | · | ✅ | · | · | · |
| `tessera` | ✅ | · | ✅ | · | · | · | · | · | · | ✅ | · | ⚠️D | · | ⚠️D | · | · | · |

### old-plains

| feature | Rocky | Lava | Ocean | Titan | Frozen | Europa | GasJ | GasS | IceN | Venus | SubN | Eye | HotJ | Mars | Magma | Carbon | Cryst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `craters` | ✅ | · | ✅ | ✅ | ✅ | ✅ | · | · | · | ✅ | · | ✅ | · | ✅ | · | · | · |
| `dunes` | ✅ | · | ✅ | ✅ | ⚠️D | · | · | · | · | ✅ | · | ✅ | · | ⚠️D | · | · | · |
| `dust` | ✅ | · | ✅ | ✅ | ⚠️D | · | · | · | · | ✅ | · | ✅ | · | ⚠️D | · | · | · |
| `ejecta` | ✅ | · | ✅ | ✅ | ✅ | ✅ | · | · | · | ⚠️D | · | ✅ | · | ✅ | · | · | · |

### volcanic-provinces

| feature | Rocky | Lava | Ocean | Titan | Frozen | Europa | GasJ | GasS | IceN | Venus | SubN | Eye | HotJ | Mars | Magma | Carbon | Cryst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `chaos` | · | · | · | · | · | ✅ | · | · | · | · | · | · | · | · | · | · | · |
| `edifices` | ✅ | ✅ | ✅ | · | · | · | · | · | · | ✅ | · | ✅ | · | ✅ | ✅ | · | · |
| `karst` | ✅ | · | ✅ | ✅ | ⚠️D | · | · | · | · | ✅ | · | ✅ | · | ✅ | · | · | · |
| `lava` | · | ✅ | · | · | · | · | · | · | · | ✅ | · | · | · | · | ✅ | · | · |

### anti-volcanic

| feature | Rocky | Lava | Ocean | Titan | Frozen | Europa | GasJ | GasS | IceN | Venus | SubN | Eye | HotJ | Mars | Magma | Carbon | Cryst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `cryoRidge` | · | · | · | · | · | ✅ | · | · | · | · | · | · | · | · | · | · | · |

### ancient-high

| feature | Rocky | Lava | Ocean | Titan | Frozen | Europa | GasJ | GasS | IceN | Venus | SubN | Eye | HotJ | Mars | Magma | Carbon | Cryst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `plateaus` | ✅ | ✅ | ✅ | · | · | · | · | · | · | ✅ | · | ✅ | · | ✅ | · | · | · |
| `scarps` | ✅ | ✅ | ✅ | · | ✅ | · | · | · | · | ✅ | · | ✅ | · | ✅ | · | · | · |
| `sublimation` | · | · | · | ✅ | ✅ | ✅ | · | · | · | · | · | ✅ | · | ✅ | · | · | · |

### young-lowlands

| feature | Rocky | Lava | Ocean | Titan | Frozen | Europa | GasJ | GasS | IceN | Venus | SubN | Eye | HotJ | Mars | Magma | Carbon | Cryst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `deltas` | ✅ | · | ✅ | ✅ | ⚠️D | · | · | · | · | ⚠️D | · | ✅ | · | ✅ | · | · | · |
| `glacial` | · | · | ✅ | ✅ | ✅ | ✅ | · | · | · | · | · | ✅ | · | ⚠️D | · | · | · |
| `outflow` | ✅ | · | ✅ | ⚠️D | ⚠️D | · | · | · | · | ⚠️D | · | ⚠️D | · | ✅ | · | · | · |
| `rivers` | ✅ | · | ✅ | ✅ | ⚠️D | · | · | · | · | ✅ | · | ✅ | · | ✅ | · | · | · |

### global

| feature | Rocky | Lava | Ocean | Titan | Frozen | Europa | GasJ | GasS | IceN | Venus | SubN | Eye | HotJ | Mars | Magma | Carbon | Cryst |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `airglow` | ✅ | · | ✅ | ✅ | · | · | · | · | · | ✅ | · | ✅ | · | ✅ | · | · | · |
| `aurora` | ✅ | · | ✅ | ⚠️D | · | · | ✅ | ✅ | ✅ | ⚠️D | ⚠️D | ⚠️D | ✅ | ⚠️D | · | · | · |
| `bands` | · | · | · | · | · | · | ✅ | ✅ | ✅ | · | ✅ | · | ✅ | · | · | · | · |
| `bioMats` | ✅ | · | ✅ | · | · | · | · | · | · | ⚠️D | · | ✅ | · | ⚠️D | · | · | · |
| `carbon` | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✅ | · |
| `cityLights` | ✅ | · | ✅ | · | · | · | · | · | · | ⚠️D | · | ✅ | · | ⚠️D | · | · | · |
| `cloudOptics` | ✅ | · | ✅ | · | · | · | · | · | · | ✅ | · | · | · | · | · | · | · |
| `clouds` | ✅ | · | ✅ | ⚠️D | ⚠️D | · | ⚠️D | ⚠️D | ⚠️D | ✅ | ✅ | ✅ | ⚠️D | ✅ | · | · | · |
| `coastlines` | ⚠️D | · | ⚠️D | ✅ | ⚠️D | · | · | · | · | ⚠️D | · | ⚠️D | · | ⚠️D | · | · | · |
| `daysideThermal` | · | · | · | · | · | · | · | · | · | · | · | · | ✅ | · | · | · | · |
| `dustStorm` | · | · | · | · | · | · | · | · | · | · | · | · | · | ✅ | · | · | · |
| `ecumenopolis` | ✅ | · | ✅ | · | · | · | · | · | · | ⚠️D | · | ✅ | · | ⚠️D | · | · | · |
| `facets` | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | · | ✅ |
| `frost` | · | · | · | ✅ | ✅ | ✅ | · | · | · | · | · | · | · | ✅ | · | · | · |
| `greatSpot` | · | · | · | · | · | · | ⚠️D | ⚠️D | ⚠️D | · | ⚠️D | · | ⚠️D | · | · | · | · |
| `hexTess` | · | · | · | · | ✅ | · | · | · | · | · | · | · | · | · | · | · | · |
| `jets` | · | · | · | · | · | · | ✅ | ✅ | ✅ | · | ✅ | · | ✅ | · | · | · | · |
| `lakes` | ✅ | · | ✅ | ✅ | ⚠️D | · | · | · | · | ⚠️D | · | ✅ | · | ⚠️D | · | · | · |
| `lightning` | ✅ | · | ✅ | 🔴F | · | · | ✅ | ✅ | ✅ | ✅ | ⚠️D | ✅ | ✅ | ✅ | · | · | · |
| `limb` | ✅ | · | ✅ | ✅ | · | · | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | · | · | · |
| `machine` | ✅ | · | ✅ | · | · | · | · | · | · | · | · | ✅ | · | · | · | · | · |
| `magma` | · | ✅ | 🔴F | · | · | · | · | · | · | · | · | · | · | · | ✅ | · | · |
| `nightsideThermal` | · | · | · | · | · | · | · | · | · | · | · | · | ✅ | · | · | · | · |
| `polarVortex` | · | · | · | · | · | · | ⚠️D | ⚠️D | ⚠️D | · | ⚠️D | · | ⚠️D | · | · | · | · |
| `shatter` | · | · | · | · | ✅ | · | · | · | · | · | · | · | · | · | · | · | · |
| `stormTrain` | · | · | · | · | · | · | ✅ | ⚠️D | ⚠️D | · | ⚠️D | · | ⚠️D | · | · | · | · |
| `sunglint` | ✅ | · | ✅ | ✅ | · | · | · | · | · | ⚠️D | · | ⚠️D | · | ⚠️D | · | · | · |
| `terminator` | ✅ | · | ✅ | ✅ | · | · | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | · | · | · |
| `weatherBands` | ✅ | · | ✅ | · | · | · | · | · | · | ⚠️D | · | ✅ | · | ✅ | · | · | · |

---

*Raw deltas: `docs/FEATURES/.sweep-raw.json`. Auditor: `lab-render-audit.js` (`tests/render-audit.test.js`). Sweep harness: `window._lab.renderDeltaSweep()` in `world-engine-lab.html`.*
