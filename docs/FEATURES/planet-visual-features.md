# Planet visual-feature inventory — L0→L1→L2 causal model

**Systems touched:** generation-planet, generation-physics, rendering-objects
**Status:** Phase 1 (the WHAT inventory). Companion to
[`planet-rendering.md`](planet-rendering.md) (the player-experience /
workstream view) and
[`../../research/RESEARCH_high-lod-planet-shaders-2026-06-05.md`](../../research/RESEARCH_high-lod-planet-shaders-2026-06-05.md)
(the HOW-to-render spec). **Created 2026-06-06.**

---

## Purpose

Inventory **what** visual features every planet can exhibit, organized by
the **physical chain that produces them** rather than by planet-type name.
The point is coverage: every terrain and climate phenomenon we've observed
in the solar system or anticipate on exoplanets should have a place in the
model, so that as we iterate feature-by-feature in the lab, nothing falls
through the cracks — and so features *derive from physical drivers* instead
of being hardcoded per type string.

This is **Phase 1 of two**:

- **Phase 1 (this doc):** the WHAT. The driver→process→feature catalogue.
- **Phase 2 (separate, later):** the data-management / representation
  design — how L0→L1→L2 gets stored and fed to the generator + shader so
  that, e.g., a "cold volatile-poor world" grows CO₂ frost because its
  *drivers* say so, not because a `type == 'ice'` branch hardcodes it.
  **Do not fold Phase 2 into this doc.**

### Two hard rules for reading and editing this doc

1. **WHAT, not HOW.** This doc names features and the **physical world
   processes** that form them ("water erodes a channel into a slope,"
   "an impact gouges a bowl and throws an ejecta blanket"). It NEVER names
   rendering techniques ("FBM erosion," "Voronoi F1 bowl," "curl noise").
   The HOW lives in the research spec and in future per-feature background
   research. If you catch yourself writing a shader term here, it belongs
   in the research spec instead.

2. **L1 is world-process, not renderer-process.** An L1 entry describes
   something that *happens on a planet over time* (erosion, orogeny,
   condensation, advection of heat). It is the bridge that lets an L2
   feature be a *consequence* of L0 physics rather than a decoration.

### How to read the IDs, layers, and tags

- **`D#` — Driver (L0).** A physics parameter. These largely *already
  exist* in `PhysicsEngine.js` / `PlanetGenerator.js` — the grounding
  finding that motivates the whole model.
- **`P#` — Process (L1).** A physical world process that converts drivers
  into surface/atmosphere conditions. **This is the gap layer** — almost
  nothing computes these today.
- **`F#` — Feature (L2).** What the player observes, defined as a function
  of L1 processes and L0 drivers, usually with **per-context variants**
  (the same driver yields different looks in different regimes).

**Status tags** (where a thing stands in *today's* build):

| Tag | Meaning |
|---|---|
| `[current]` | Renders / is computed in the live build today. |
| `[partial]` | Half-wired — data exists but isn't consumed, or only one variant ships. |
| `[aspirational]` | Not built. The bulk of L1 and most close-up L2 relief. |
| `[subtle]` | Inventory-complete but low render-priority — a real-world feature that the 6-level Bayer/posterize envelope will likely crush or render only as a faint tint. Kept for completeness; flagged so HOW-research deprioritizes it or treats it as stylized. |

Every `P#` and `F#` is a **self-contained hook for a future background
HOW-research task** — the workflow is: research the HOW per feature in the
background while iterating the lab feature-by-feature.

### The three render families (from the generator)

18 types, grouped by shader dispatch (`Planet.js:985-987`, verified):

- **GAS** — gas-giant, hot-jupiter, eyeball, sub-neptune
- **ROCKY** — rocky, ice, lava, ocean, terrestrial, venus, carbon
- **EXOTIC** — hex, shattered, crystal, fungal, machine, city-lights, ecumenopolis

The 18 types are not the spine of this doc — they are **presets** (named
driver-range bundles) in **Appendix A**. The spine is L0→L1→L2.

---

## L0 — Drivers

The physics layer already computes most of these. `PhysicsEngine.js`
exports **31** driver functions; the subset that feeds visuals is below.
"Where" cites the live code (spot-verified 2026-06-06).

| ID | Driver | What it is | Where computed | Status |
|---|---|---|---|---|
| **D1** | `equilibriumTemperature` (T_eq) | Insolation → blackbody surface temp. The master gate for volatile state, snowlines, habitability. | `PhysicsEngine.js:121` | `[current]` |
| **D2** | `volatileFraction` | Frost-line water/ice budget (how much volatile the world has to work with). | `deriveComposition` `:357-365` | `[current]` |
| **D3** | `axialTilt` (obliquity) | Spin-axis tilt → seasons, polar-cap cycling, latitude of frost lines. | `PlanetGenerator.js:654`, surfaced `:698` | `[current]` |
| **D4** | atmosphere **composition** | n2-o2 / co2 / co2-n2 / h2-he / none → cloud species, haze chemistry, sky color. | `computeAtmosphere:140` | `[current]` |
| **D5** | atmosphere **density** | Thin↔thick → wind transport, dune-building, opacity, pressure-gated volcanism (Venus pancakes). | `computeAtmosphere:140` | `[current]` |
| **D6** | atmosphere **retention** | Whether the atmosphere survives (Jeans escape + UV stripping). Gated by D13. | `computeAtmosphere` (Jeans `:96`, escapeVel `:81`, exosphericTemp `:108`) | `[current]` |
| **D7** | tidal-lock state | Locked → permanent day/night hemispheres → eyeball climate, substellar magma, terminator rings. | `checkTidalLock:274`, `tidalLockTimescale:258` | `[current]` |
| **D8** | rotation rate | Spin speed (0 if locked). Drives zonal banding, jets, Coriolis storms, field strength. | `PlanetGenerator.js:659-665`, surfaced `:697` | `[current]` |
| **D9** | `ironFraction` | Core iron → magnetic-field strength (D13) and surface mineralogy. | `deriveComposition:350` | `[current]` |
| **D10** | `carbonToOxygen` | C/O ratio. High → carbon-planet surfaces (graphite/diamond/carbide, tar plains). | `deriveComposition:344` | `[current]` |
| **D11** | surface-history | Impact flux + tidal-heat resurfacing budget. The "how long ago / how extreme" data for terrain age. | `computeSurfaceHistory:733` | `[current]` |
| **D12** | tidal heating | Tidal flexing → interior heat → resurfacing, cryovolcanism, Io-grade volcanism. Depends on eccentricity (`circularize:321`). | `tidalHeating:295` | `[current]` |
| **D13** | **magnetic field strength** | `ironFraction × rotation factor`. **Cross-cutting gate** — see callout below. | `PhysicsEngine.js:168` (stripping), `PlanetGenerator.js:440` (aurora) | `[current]` *(computed internally; not surfaced as a first-class planet-data field → `[partial]` exposure)* |
| **D14** | mass / gravity | Earth-masses & surface g. Sets crater simple→complex transition, shield-volcano scale, escape velocity, dune repose. | `estimateMassEarth:61`, `escapeVelocity:81` | `[current]` |
| **D15** | habitability | Composite liveability score. Gates biotic/oceanic features and the artificial-overlay types. | `habitabilityScore:576` | `[current]` |
| **D16** | planet / surface age | Time available for weathering, crater accumulation, biosphere/technosphere development. Star evolves T_eq over this (`stellarEvolution:653`, `mainSequenceLifetime:639`). | derived | `[current]` |

> ### D13 — Geomagnetism is a cross-cutting GATE, not just "aurora"
> The magnetic field does two visually decisive things, both already
> modeled in code:
> 1. **Aurora gate** — no field, no aurora. `fieldStrength > 0.05` is the
>    threshold (`PlanetGenerator.js:449`); ring latitude/width scale with
>    field strength (`:474-475`).
> 2. **Atmosphere-retention gate** — a weak field lets the stellar wind
>    strip the atmosphere: `stripRate = uvFlux / fieldStrength`
>    (`PhysicsEngine.js:172`), with a hard `uvStripFactor` when
>    `fieldStrength < 0.1` (`:180`). **An unshielded world loses its
>    atmosphere (D6), which removes the entire weather + fluvial + aeolian
>    stack.** So geomagnetism silently determines whether a planet is a
>    living, weathered world or an airless, cratered, wind-still rock.
>
> Nuance for Phase 2: the field value is currently computed *inline* inside
> two functions and consumed locally — it is **not exposed as a standalone
> driver field** the way T_eq or volatileFraction are. Surfacing it is a
> Phase-2 data-management item.

---

## L1 — Processes (the gap layer)

Almost nothing here is computed today (the generator keys features off
`type` strings instead of deriving them through these processes). Each
process lists the drivers it consumes, its **timescale / variability
signature**, and an **intensity** axis (the "how extreme" magnitude Max
named). Tags reflect whether *any* consequence of the process renders now.

### L1a — Geomorphic (solid-surface) processes

| ID | Process | Physical description | Drivers | Timescale signature | Intensity axis | Status |
|---|---|---|---|---|---|---|
| **P1** | Impact cratering | Impactors gouge bowls, throw ejecta, and (at size) rebound into central peaks / multi-ring basins. Crater **density = surface age**. | D11, D14, D5 (thick air burns small impactors), D2 (fluidized ejecta on ice) | Accumulates over D16; saturation = ancient | impactor energy → simple pit … saturated basin field | `[partial]` (impact-basin height in rocky; full crater morphology aspirational) |
| **P2** | Tectonic deformation | Crust stretches, contracts, or slides → fault scarps, rifts/grabens, wrinkle ridges, plateaus, tessera. | D11, D12, D14, D16 (cooling→contraction), D2 (ice-shell extension) | Active or fossil; crosscuts what it offsets | local fault … globe-girdling scarp/rift system | `[aspirational]` |
| **P3** | Orogeny (plate tectonics) | Plate convergence crumples crust into fold mountain belts; full plate system gives ridges/trenches/transforms. **Earth-only in the solar system** — treat as terrestrial/ocean-exclusive. | D12, D14, D15 (water lubricates subduction) | Grows over 10s Myr, erodes over Gyr | single anticline … Himalaya-scale belt | `[aspirational]` |
| **P4** | Volcanism (effusive) | Low-viscosity magma builds shields, lava plains/flood basalts, channels, tubes; pressure-gated pancake domes on thick-air worlds. | D12, D14 (low-g → giant shields), D5 (pressure), D11 | Builds over Myr; resets local surface age | single flow … million-km² flood-basalt province | `[partial]` (lava-type cracks; relief aspirational) |
| **P5** | Volcanism (explosive) | Gas-rich magma erupts stratovolcanoes, calderas, pyroclastic blankets. | D12, D2/D4 (volatiles drive explosivity), D14 | 10⁴–10⁵ yr edifice; ashfall mantles | cinder cone … collapse caldera + ignimbrite sheet | `[aspirational]` |
| **P6** | Tidal-heat resurfacing | Relentless tidal flexing keeps the interior molten → heat-pipe volcanism continuously repaves the surface, **erasing craters (zero-age surface)**. Io-grade. | D12, D7, D14 | Continuous; chronically crater-free | patchy hotspots … global resurfacing | `[partial]` (data in surface-history; not visualized) |
| **P7** | Cryovolcanism | Pressurized cryomagma (water+ammonia/brine) ascends fractures and erupts as cryolava, building domes/plains and resurfacing icy shells. | D2, D12, D1 (cryolava freezes on a cold surface) | Resurfaces regions; very young on active worlds | single dome … planet-scale cryo-resurfacing | `[aspirational]` |
| **P8** | Fluvial erosion/deposition | A **liquid** (water, *or* methane/ethane on cold worlds) flows downslope: incises channels/canyons, builds dendritic networks, deltas, alluvial fans; catastrophic release carves outflow channels. | D1 + D2 + D6 (liquid stability), D14, D4 (rain) | Active=sharp banks; relict=degraded. 10³–10⁷ yr | trickle rill … continental trunk river / megaflood | `[aspirational]` |
| **P9** | Aeolian (wind) transport | Wind drives sand into migrating dunes (barchan/linear/star), abrades yardangs & ventifacts, lays dust mantles, paints wind streaks. | D5 (air to move grains), D8/circulation, dry surface (low D-liquid), D14 | Migrates m–10m/yr; field = sustained dry+windy | single crescent … planet-scale erg (dune sea) | `[aspirational]` |
| **P10** | Glacial flow | Accumulated frozen volatiles compact and flow under their own weight → ice sheets, U-valleys, fjords, moraines, eskers, layered polar deposits. | D2, D1 (cold), D14, D3 (polar accumulation) | Builds/retreats 10³–10⁶ yr; flow lineations | valley glacier … continental ice sheet | `[partial]` (terrestrial/eyeball polar caps; flow landforms aspirational) |
| **P11** | Sublimation / volatile etching | Frozen volatiles pass solid→gas where insolation hits: sublimation pits, Swiss-cheese terrain, bladed terrain/penitentes, araneiform "spider" terrain, convection polygons. | D1, D2 (which volatile: N₂/CO₂/CH₄), D3 (seasonal), D5 (thin) | Active=sharp; tracks cm/yr convection | single pit … basin-filling pit/polygon field | `[aspirational]` |
| **P12** | Mass-wasting | Slope material fails under gravity → landslides, slump scarps, talus aprons, ice-cemented lobate debris aprons. | D14, slope, trigger (quake/undercut), D2 (ground ice) | Single event (sharp lobe) or slow creep | small slump … long-runout sturzstrom | `[aspirational]` |
| **P13** | Coastal / shoreline action | A standing liquid body's margin erodes & deposits → shorelines/strandlines, sea cliffs, beaches/terraces; abandoned levels record paleo-climate. | liquid-stability (D1+D2+D6), wave/tide energy, D14 | Paleo-shorelines = climate record | faint bench … stacked terrace flight | `[aspirational]` |
| **P14** | Karst / chemical dissolution | A solvent (water, *or* exotic) eats soluble crust → sinkholes, labyrinth/dissolution terrain, collapse lakes. | soluble lithology, solvent liquid, D11, D4 (rain) | Maturity = degree of dissection | shallow grooves … deep labyrinth maze | `[aspirational]` |
| **P15** | Crustal tessellation / fracture | Cooling-contraction or convective stress tiles the crust into regular polygons; catastrophic stress shatters it into chaotic blocks; slow crystallization grows facet fields. | D11, D16 (cooling), uniform lithology, D12/tidal stress | Pattern records cooling/disruption history | local polygons … planet-wide hex tiling / global shatter | `[aspirational]` (exotic geometric types) |

### L1b — Climatic / atmospheric processes

| ID | Process | Physical description | Drivers | Variability signature | Intensity axis | Status |
|---|---|---|---|---|---|---|
| **P16** | Zonal banding | Differential heating + rotation organize deep convection into alternating prograde/retrograde latitude bands; condensation brightens zones, sinking clears belts. | D8 (fast spin), D5, interior heat, D1 | Permanent; bands drift/fade over years | faint 2–3 bands … high-contrast many-banded | `[current]` (gas-giant) |
| **P17** | Vortex / storm formation | Shear + convection spin up anticyclones (GRS-class), polar vortices (incl. polygonal/hexagon jets, cyclone-cluster lattices), storm trains, convective plumes, lightning. | D8, D5/depth, zonal shear, interior heat, condensables | quasi-permanent (decades) → transient (days) | single oval … planet-scale spot / cyclone ring | `[current]` single GRS; `[partial]` multi-storm (generated `storms.spots` unwired) |
| **P18** | Cloud condensation | Each volatile condenses at its own T/P level → stacked composition-specific decks (H₂O/NH₄SH/NH₃; CH₄ on cold giants; H₂SO₄ on Venus). **"Clouds" is a family — see F-clouds.** | D4, D5, D1 gradient, depth | Permanent stratification; decks vary | one deck … several color-distinct stacked decks | `[current]` (terrestrial weather; venus blanket; basic clouds) |
| **P19** | Photochemical haze | UV breaks up CH₄/N₂ → tholin/aerosol haze that mutes deeper structure; settles into layered/detached shells (Titan, sub-neptune). | D4, D1 (UV/insolation), D6 | Quasi-permanent; layer altitude shifts seasonally | slight muting … fully flat featureless globe | `[partial]` (sub-neptune haze; layered shells aspirational) |
| **P20** | Meridional circulation | Hadley/Ferrel/polar cells + ITCZ/monsoon convergence set wet/dry latitude belts and migrating storm bands on terrestrials. | D1, D3, D8, D5, D2 | Permanent zones; ITCZ migrates seasonally | faint zonation … crisp multi-zone bands | `[current]` (terrestrial latitude weather) |
| **P21** | Tidally-locked circulation | Permanent day/night drives substellar standing convection + a day→night terminator flow: standing cloud over the "pupil," terminator cloud ring, nightside condensation, asymmetric limbs, eastward-shifted hotspot (superrotation). | D7, D1 contrast, D8, D5, D2 | Permanent (locked to star); limb asymmetry steady | thin cap … bright standing cloud + full terminator ring | `[current]` eyeball climate rings; `[partial]` hot-jupiter hotspot |
| **P22** | Seasonal volatile cycling | Volatiles condense onto the winter pole as frost and sublimate in spring; on thin-air worlds a big fraction of the *atmosphere itself* cycles (pressure breathing). Surface expression of the **snowline**. | D3, D1 near condensation pt, D2, D5 | Seasonal (annual cycle); pressure swings | thin frost rim … cap reaching mid-latitudes | `[partial]` (terrestrial/eyeball caps; seasonal dynamics aspirational) |
| **P23** | Aerosol / dust lofting | Wind stress + dust devils loft surface dust; radiative feedback can grow it into a planet-encircling storm; settling leaves a permanent haze veil. | D5, loose dust, D1, D3, D14 | Transient (weeks–months); seasonal/interannual | local dust cloud … whole-planet ochre obscuration | `[partial]` (optional rocky/Mars dust storms) |
| **P24** | Aurora & airglow | Charged particles funneled by the magnetic field precipitate near the magnetic poles → auroral ovals; photochemistry adds a faint airglow limb band. | **D13** (hard gate), D4, stellar wind/D1 | Transient flicker; oval geometry steady | none (no field) … bright persistent polar ovals | `[current]` (physics-gated aurora) |
| **P25** | Atmospheric escape / stripping | Weak field + high UV lets the stellar wind erode the atmosphere over time — **the gate that decides whether P8/P9/P18/P20 exist at all.** | **D13**, D6, D14, D1 | Cumulative over D16; can run to airless | fully retained … stripped to bare rock | `[current]` (modeled; consequence not visualized as such) |
| **P26** | Optical / atmospheric scattering | Slant-path & aerosol scattering brighten the limb (rim glow / blue line), redden the terminator, and mirror the star off liquid (sunglint). | D5, aerosol, D6, geometry, surface liquid | Permanent rim/terminator; sunglint tracks geometry | sharp edge … thick glowing limb halo | `[current]` fresnel limb glow & terminator; `[aspirational]` sunglint |

---

## L2 — Observable features

Grouped by family. Each feature lists the L1/L0 it derives from, its
**variants** (the same driver → different look by regime), real-body
examples, the WD types that plausibly exhibit it, and status. This is the
catalogue future HOW-research draws tasks from.

### F-relief — surface relief & topology (close-up / LOD2)
*Derives from: P1–P15. Mostly `[aspirational]` — `Planet.js` declares
`lodLevel` but never reads it (`:44`, `:1077`), so there is no close-up
detail today.*

| ID | Feature | From | Variants | Examples | WD types | Status |
|---|---|---|---|---|---|---|
| **F1** | Mountains / ranges | P2, P3, P4 | tectonic fold belt · volcanic shield/strato · ridged crestlines | Himalaya, Olympus Mons, Tharsis | rocky, terrestrial, venus, lava, ice, carbon | `[aspirational]` |
| **F2** | Craters | P1 | simple bowl · complex (central peak + terraces) · peak-ring · multi-ring basin · palimpsest (relaxed) | Tycho, Orientale, Caloris, Valhalla | rocky, ice, terrestrial, venus, carbon, machine, shattered, crystal | `[partial]` (basin height only) |
| **F3** | Ejecta & rays | P1 | continuous blanket · discontinuous · rampart (fluidized, icy/wet) · bright ray system (airless only) · secondary fields | Tycho rays, Mars ramparts | rocky, ice, terrestrial, machine, crystal | `[aspirational]` |
| **F4** | Canyons / rifts | P2, P8 | tectonic graben/chasma · fluvial-incised gorge · cryo-chasma | Valles Marineris, Grand Canyon, Charon chasmata | terrestrial, rocky, venus, ice, ocean | `[aspirational]` |
| **F5** | Scarps & fault systems | P2 | normal-fault cliff · lobate contraction scarp · wrinkle ridge · horst-and-graben province | Discovery Rupes, lunar maria ridges | rocky, mercury-like, terrestrial, venus, ice | `[aspirational]` |
| **F6** | Plateaus / highlands / tessera | P2, P15 | uplift plateau · crustal-plateau tessera (crosscutting lattice) | Tibetan Plateau, Ovda Regio | terrestrial, venus, rocky, hex, shattered | `[aspirational]` |
| **F7** | Volcanic edifices | P4, P5 | shield · stratovolcano · caldera · pancake dome (thick-air) · corona/nova/arachnoid (plume) | Mauna Loa, Sapas Mons, Venus coronae | rocky, terrestrial, venus, lava, carbon | `[aspirational]` |
| **F8** | Lava plains & flows | P4 | flood-basalt plain · leveed channel · sinuous rille · collapsed tube/pit chain | lunar maria, Venusian canali, Io flows | rocky, lava, venus, terrestrial, ice, machine | `[partial]` (lava cracks) |
| **F9** | Chaos / disrupted terrain | P2, P6, P7 | ice-shell chaos (rafts) · volatile-outflow collapse · antipodal seismic jumble | Conamara Chaos, Caloris antipode | ice, ocean, rocky, shattered | `[aspirational]` |
| **F10** | Ridged / grooved icy terrain | P2, P7 | double ridges · grooved bands · lenticulae (diapirs) · refrozen-crack networks | Europa, Ganymede, Enceladus | ice, ocean | `[aspirational]` |

### F-gradational — water/wind/ice-shaped landforms
*Derives from: P8–P14. Existence gated by D6/P25 (need a retained
atmosphere + stable liquid) — an airless world skips this whole family.*

| ID | Feature | From | Variants | Examples | WD types | Status |
|---|---|---|---|---|---|---|
| **F11** | River networks & valleys | P8 | dendritic network · meanders · single trunk · relict (degraded) | Earth, Titan (methane), Mars (relict) | terrestrial, ocean, ice, eyeball, carbon (hydrocarbon) | `[aspirational]` |
| **F12** | Deltas & alluvial fans | P8 | birdsfoot delta · fan · coalesced bajada | Titan deltas, Mars fans | ocean, terrestrial, eyeball | `[aspirational]` |
| **F13** | Outflow / megaflood channels | P8 | streamlined-island scoured channel | Kasei Valles, Channeled Scablands | terrestrial, ice, ocean | `[aspirational]` |
| **F14** | Lakes & seas (standing liquid) | P8, P13 | water sea · methane/ethane sea · dry playa/lakebed | Earth oceans, Titan Kraken Mare | ocean, terrestrial, eyeball, carbon | `[partial]` (ocean-type water + islands) |
| **F15** | Dunes & wind forms | P9 | barchan · linear · star · yardang · ventifact · wind streak | Namib, Titan dune belts, Mars | terrestrial, venus, ice, carbon, lava (silicate sand) | `[aspirational]` |
| **F16** | Dust mantles | P9, P23 | thin veneer · deep loess · butterscotch haze tint | Mars dust mantle | terrestrial, venus, ice, rocky | `[aspirational]` |
| **F17** | Glacial landforms | P10 | ice sheet/glacier · U-valley · fjord · moraine · esker · polar layered deposits | Earth, Mars, Pluto N₂ glaciers | ice, terrestrial, eyeball, ocean | `[aspirational]` |
| **F18** | Sublimation landscapes | P11 | pits/hollows · Swiss-cheese · bladed/penitente · araneiform spiders · convection polygons | Pluto Sputnik Planitia, Mars S-pole | ice, terrestrial, eyeball | `[aspirational]` |
| **F19** | Mass-wasting deposits | P12 | landslide lobe · slump terraces · talus apron · lobate debris apron | Valles landslides, Mars LDAs | all rocky, ice | `[aspirational]` |
| **F20** | Coastlines | P13 | strandline/paleo-shoreline · sea cliff · beach/terrace | Earth, Titan lake margins | ocean, terrestrial, eyeball | `[aspirational]` |
| **F21** | Karst / dissolution | P14 | sinkhole/doline · labyrinth maze · collapse lake | Titan labyrinth, Earth limestone | terrestrial, ice, carbon, ocean | `[aspirational]` |

### F-volatile-surface — climate-painted surface patterns
*Derives from: P22 (the snowline / frost cycle). The bridge family between
climate and terrain.*

| ID | Feature | From | Variants | Examples | WD types | Status |
|---|---|---|---|---|---|---|
| **F22** | Polar caps & frost fields | P22, P10 | perennial water cap · seasonal CO₂ frost · N₂/CH₄ frost field · **eyeball nightside cap + terminator melt ring** | Earth, Mars, Triton, Pluto | terrestrial, ice, eyeball, rocky | `[partial]` (terrestrial/eyeball caps) |
| **F23** | Snowline / frost-coverage boundary | P22 | sharp coverage line · diffuse tint · latitude vs. altitude band | Earth snowline, Mars frost edge | rocky, ice, terrestrial, eyeball | `[aspirational]` |

### F-bands — atmospheric banding (the visible "surface" of gas worlds)
*Derives from: P16, P20, P21.*

| ID | Feature | From | Variants | Examples | WD types | Status |
|---|---|---|---|---|---|---|
| **F24** | Zonal belts & zones | P16 | high-contrast many-banded (Jupiter) · soft few-banded · bland blue + sparse CH₄ clouds (ice giant) | Jupiter, Saturn, Neptune | gas, sub-neptune, hot-jupiter | `[current]` |
| **F25** | Jets & shear turbulence | P16 | equatorial superrotation jet · counter-rotating jet shear · festoon/scallop turbulence | Jupiter belt edges | gas, hot-jupiter, venus | `[partial]` (turbulence in gas-giant) |
| **F26** | Latitude weather bands (terrestrial) | P20 | Hadley/Ferrel zonation · ITCZ/monsoon convergence band | Earth | terrestrial, ocean, eyeball | `[current]` |

### F-storms — vortices & discrete storms
*Derives from: P17.*

| ID | Feature | From | Variants | Examples | WD types | Status |
|---|---|---|---|---|---|---|
| **F27** | Great-spot anticyclone | P17 | single giant oval · dark spot | Jupiter GRS, Neptune GDS | gas, hot-jupiter | `[current]` (single) |
| **F28** | Storm clusters / oval trains | P17 | white-oval train · "string of pearls" · convective plume outbreak | Jupiter ovals, Saturn GWS | gas, hot-jupiter, sub-neptune | `[partial]` (`storms.spots` generated, unwired) |
| **F29** | Polar vortex | P17 | single cyclonic cap · **polygonal jet (Saturn hexagon)** · cyclone-cluster lattice (pentagon/hexagon ring) | Saturn hexagon, Jupiter poles, Venus | gas, venus, eyeball, hex | `[partial]` (polar darkening only) |
| **F30** | Lightning / electrical storms | P17 | flash clusters in convective regions · (sprites — `[subtle]`) | Jupiter, Saturn, Earth | gas, sub-neptune, terrestrial, ocean | `[aspirational]` |

### F-clouds — the cloud/haze FAMILY (one driver, six looks)
*Derives from: P18, P19, P21. **Same driver (atmosphere), different L1
regime, different L2 look** — this is the canonical example of why the
model is process-first.*

| ID | Variant | From | Look | Examples | WD types | Status |
|---|---|---|---|---|---|---|
| **F31a** | Terrestrial weather clouds | P18, P20 | patchy/banded white over visible ground | Earth | terrestrial, ocean | `[current]` |
| **F31b** | Gas-giant band tops | P16, P18 | the cloud deck *is* the visible surface | Jupiter | gas, hot-jupiter | `[current]` |
| **F31c** | Sub-neptune featureless haze | P19 | flat, structureless muted globe | GJ 1214 b | sub-neptune, eyeball | `[partial]` |
| **F31d** | Venus opaque blanket | P18 | total reflective shroud; faint UV Y-markings (`[subtle]`) | Venus | venus | `[current]` |
| **F31e** | Layered / detached haze shells | P19 | stacked aerosol shells, detached upper layer | Titan, Pluto | sub-neptune, ice, terrestrial | `[aspirational]` |
| **F31f** | Eyeball substellar cloud + terminator ring | P21 | fixed bright "pupil" cloud + day/night terminator ring | modeled tidally-locked worlds | eyeball | `[current]` (climate rings) |

### F-thermal — irradiation-driven emission (tidally-locked hot worlds)
*Derives from: P21.*

| ID | Feature | From | Variants | Examples | WD types | Status |
|---|---|---|---|---|---|---|
| **F32** | Dayside thermal hotspot | P21 | warm dayside · glowing molten-bright dayside · eastward-shifted hotspot (superrotation) | HD 209458 b, WASP-43 b | hot-jupiter | `[current]` (day-side thermal) |
| **F33** | Nightside thermal glow | P21 | dim self-emission + patchy mineral/silicate nightside clouds | ultra-hot Jupiters | hot-jupiter | `[current]` (night-side glow) |

### F-optical — limb, terminator, glint, aurora
*Derives from: P24, P26.*

| ID | Feature | From | Variants | Examples | WD types | Status |
|---|---|---|---|---|---|---|
| **F34** | Limb / atmosphere rim glow | P26 | fresnel rim · blue line · thick haze halo | Earth blue line, Titan | all atmospheric types | `[current]` (fresnel limb) |
| **F35** | Terminator color gradient | P26 | reddened day/night boundary · twilight band | Earth sunsets, Mars blue sunsets | terrestrial, rocky, venus | `[current]` (terminator day/night) |
| **F36** | Sunglint off liquid | P26 | sharp specular spot on water / methane sea | Earth glint, Titan Kraken glint | ocean, terrestrial, eyeball | `[aspirational]` (no specular glint in pipeline) |
| **F37** | Aurorae | P24 | polar ovals · ring latitude/width by field strength | Earth, Jupiter, Saturn | terrestrial, gas, ocean, city-lights | `[current]` (physics-gated) |
| **F38** | Airglow / nightglow limb band | P24 | faint diffuse night-limb ring | Earth airglow | terrestrial, ocean, venus | `[subtle]` |
| **F39** | Cloud optics (rainbows / glories) | P26 | colored arcs/rings of uniform-droplet clouds | Earth rainbows, Venus glory | terrestrial, ocean, venus | `[subtle]` |

### F-dust — aeolian atmospheric features
*Derives from: P23.*

| ID | Feature | From | Variants | Examples | WD types | Status |
|---|---|---|---|---|---|---|
| **F40** | Dust storms | P23 | dust devil tracks · regional dust front · planet-encircling global storm | Mars | rocky, terrestrial (arid), venus | `[partial]` (optional Mars dust storms) |

### F-exotic-natural — speculative natural endmembers
*Derives from: P4/P6 (extreme heat), P15 (crystallization/fracture), D10
(carbon chemistry). Flagged confidence: anticipated → speculative.*

| ID | Feature | From | Variants | Examples | WD types | Status |
|---|---|---|---|---|---|---|
| **F41** | Hemispheric magma ocean | P4, P6, D7, D1(extreme) | molten dayside sea · magma shoreline/waves at terminator · nightside rock-frost condensate plains | K2-141b, 55 Cnc e (candidates) | lava, eyeball | `[aspirational]` *(speculative)* |
| **F42** | Carbon-world crust | D10 | graphite plain · diamond-studded ridges · hydrocarbon/tar flats | hypothesized carbon planets | carbon, crystal, rocky | `[aspirational]` *(speculative)* |
| **F43** | Crystalline facet field | P15 | scattered crystals … continuous faceted field | none confirmed | crystal, carbon, lava (cooled) | `[aspirational]` *(speculative)* |
| **F44** | Hexagonal-tessellated crust | P15 | small polygons … planet-wide hex tiling | basalt columns, Pluto polygons (small analogs) | hex, rocky, ice | `[aspirational]` *(speculative)* |
| **F45** | Shattered / fractured crust | P15 | local fracture zone … globally shattered blocks | Miranda (analog) | shattered, rocky, ice | `[aspirational]` *(speculative)* |

### F-overlay — artificial / biotic surface coatings
*These four EXOTIC types have **no geomorphic formation** — they are a
**surface-coating layer over a base terrain**, driven by D15 (habitability)
+ D16 (age), not erosion physics. See Appendix A note. Confidence:
speculative game-construct.*

| ID | Feature | From | Variants | Examples | WD types | Status |
|---|---|---|---|---|---|---|
| **F46** | Bioluminescent / fungal mats | D15, D16, liquid | sparse patches … planet-spanning living mat | none confirmed | fungal | `[current]` (bioluminescent spots) |
| **F47** | Machine / structured surface | D15→tech, D16 | scattered structures … fully machined crust (circuit grid) | Dyson-tier hypothetical | machine | `[current]` (circuit grid) |
| **F48** | City lights | D15, D16, D7 (nightside) | scattered cities … continuous urban band; lit nightside | Earth-at-night (nascent) | city-lights, eyeball (nightside cities) | `[current]` (night-side city lights) |
| **F49** | Ecumenopolis | D15, D16 | planet-covering megacity (whole-surface glow) | fictional (Coruscant) | ecumenopolis | `[current]` (whole-surface city glow) |

### F-crosscutting — universal, type-agnostic
*Render envelope + system-level features that apply across all bodies.*

| ID | Feature | Status |
|---|---|---|
| **F50** | Posterize + 4×4 Bayer dither (the retro envelope) | `[current]` (universal) |
| **F51** | Rings (banded + Cassini gap + shepherd gaps + planet-shadow) | `[current]` inline path; `[partial]` (dead `RingRenderer.js` multi-band, never instantiated) |
| **F52** | Eclipse / moon shadows | `[current]` |
| **F53** | Close-up LOD2 surface detail | `[aspirational]` (`lodLevel` uniform dead — declared, never read) |

---

## Appendix A — Type presets (the 18 types as driver bundles)

Each type is a **named driver-range bundle** → which features (and which
variant) it exhibits. The types are *presets*, not the model; two types
with overlapping drivers should share features.

| Type | Family | Driver signature (L0) | Headline features (F#) |
|---|---|---|---|
| **rocky** | ROCKY | moderate mass, thin/no atmo, old surface | F1 F2 F3 F5 F8 F19 F40 |
| **terrestrial** | ROCKY | habitable T_eq, retained N₂-O₂ atmo, water | F11 F12 F14 F17 F22 F26 F31a F34 F35 F37 (richest) |
| **ocean** | ROCKY | water world, full-coverage liquid | F14 F20 F36 F31a F34 (+ no/low relief) |
| **ice** | ROCKY | cold T_eq, high volatileFraction | F2 F9 F10 F17 F18 F22 (cryo-dominant) |
| **lava** | ROCKY | extreme T_eq or high tidal-heat | F8 F41 + emissive cracks |
| **venus** | ROCKY | thick CO₂ atmo, high surface pressure | F31d F7(pancake) F29(polar vortex) F25 |
| **carbon** | ROCKY | high C/O ratio | F42 + dark surface + emissive diamond glints |
| **gas-giant** | GAS | massive H₂-He envelope, fast spin | F24 F25 F27 F28 F29 F30 (band/storm world) |
| **hot-jupiter** | GAS | gas giant at extreme insolation, tidally locked | F32 F33 F24 (thermal day/night) |
| **eyeball** | GAS* | tidally locked rocky/ocean | F31f F22(terminator ring) F41(hot lobe) F48(night cities) |
| **sub-neptune** | GAS | thick high-metallicity haze envelope | F31c F31e F19/haze (featureless) |
| **hex** | EXOTIC | — (geometric preset) | F44 F29(hexagon hook) |
| **shattered** | EXOTIC | — (catastrophic-disruption preset) | F45 F9 |
| **crystal** | EXOTIC | — (crystallization preset) | F43 F3(glints) |
| **fungal** | EXOTIC | habitable + biosphere (overlay) | F46 over a terrestrial/ocean base |
| **machine** | EXOTIC | habitable→tech (overlay) | F47 over a rocky base |
| **city-lights** | EXOTIC | habitable + civilization (overlay) | F48 over a terrestrial base |
| **ecumenopolis** | EXOTIC | advanced civilization (overlay) | F49 over a terrestrial base |

> **Overlay-type design note (Phase-2 input).** `fungal`, `machine`,
> `city-lights`, and `ecumenopolis` should be modeled as a **coating layer
> applied over an underlying base terrain** (an ecumenopolis sits on what
> *was* a terrestrial world), not as from-scratch landform generators.
> Their meaningful drivers are D15 + D16, not erosion. `hex`, `crystal`,
> and `shattered` are different — those have plausible *natural* physical
> premises (P15) and can be driven by real L0 params.

---

## Appendix B — Coverage matrix (features × families)

Quick gap-spotter. ●=core/current, ◐=partial-or-some-variant,
○=aspirational-but-applicable, –=not applicable.

| Feature family | rocky | terran | ocean | ice | lava | venus | carbon | gas | hotJ | eyeball | subN | exotic |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F-relief (mountains/craters/scarps) | ◐ | ○ | – | ○ | ○ | ○ | ○ | – | – | ○ | – | ○ |
| F-gradational (rivers/dunes/glaciers) | ○ | ○ | ◐ | ○ | – | ○ | ○ | – | – | ○ | – | – |
| F-volatile-surface (caps/snowline) | ○ | ◐ | ○ | ◐ | – | – | – | – | – | ◐ | – | – |
| F-bands (zonal/jets) | – | ● | ○ | – | – | ◐ | – | ● | ◐ | ◐ | ◐ | – |
| F-storms (vortices) | – | ○ | ○ | – | – | ◐ | – | ● | ◐ | ◐ | ○ | ◐(hex) |
| F-clouds (haze family) | – | ● | ● | ○ | – | ● | – | ● | ● | ● | ◐ | – |
| F-thermal (day/night emission) | – | – | – | – | ○ | – | – | – | ● | ◐ | – | – |
| F-optical (limb/glint/aurora) | ◐ | ● | ◐ | ◐ | – | ◐ | – | ● | ◐ | ◐ | ◐ | ◐ |
| F-dust | ◐ | ◐ | – | – | – | ◐ | – | – | – | – | – | – |
| F-exotic-natural | – | – | – | ○ | ○ | – | ○ | – | – | ○ | – | ● |
| F-overlay (artificial) | – | – | – | – | – | – | – | – | – | ◐ | – | ● |

**Biggest gaps the matrix reveals:** the entire **F-relief** and
**F-gradational** rows are `○`/`◐` — i.e. close-up terrain is unbuilt
across *every* rocky type (the dead-`lodLevel` story). That is the single
largest coverage hole, and it lines up exactly with the LOD2 research spec.

---

## See also

- [`planet-rendering.md`](planet-rendering.md) — player-experience /
  workstream view of the same surface (10 FEATURES.md rows, the 4
  provisional workstreams). This doc is its **WHAT-side companion**.
- [`../../research/RESEARCH_high-lod-planet-shaders-2026-06-05.md`](../../research/RESEARCH_high-lod-planet-shaders-2026-06-05.md)
  — the HOW spec. When a feature here goes into background HOW-research,
  reuse that doc's vocabulary (analytic-derivative noise, ridged
  multifractal, domain warp, Voronoi craters, Gerstner waves,
  clouds-as-relief, emissive bypass).
- `src/generation/PhysicsEngine.js` — the L0 driver computations.
- `src/generation/PlanetGenerator.js` — type presets, per-type generation.
- `src/objects/Planet.js` — the live per-type shader (what `[current]`
  means).

## Open threads (for Phase 2 and beyond)

- **Phase 2 — representation design.** How L0→L1→L2 is stored and fed to
  generation + renderer so features derive from drivers, not type strings.
  The overlay-type model (Appendix A note) and surfacing the magnetic-field
  driver (D13) are inputs to it.
- **Rotation-rate exposure.** `rotationSpeed` exists (`:697`) but confirm
  it (not just tidal-lock boolean) reaches anything that could drive band
  count / jet speed.
- **Per-feature HOW-research.** Each `F#`/`P#` is a hook. Prioritize by the
  Appendix-B gaps: F-relief and F-gradational are the widest holes.
- **Posterization triage.** The `[subtle]` features (F38, F39, sprites, UV
  Y-markings) need an explicit keep/stylize/drop call when their
  HOW-research comes up — don't spend relief budget on effects the
  6-level envelope crushes.
