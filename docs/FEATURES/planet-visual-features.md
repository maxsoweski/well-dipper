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
| `[lab]` | **Built and rendering in the World Engine Lab, but NOT wired into the game.** Added 2026-08-06. |
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

### L1c — Biotic / technogenic processes

The four artificial/biotic EXOTIC types (`fungal`, `machine`,
`city-lights`, `ecumenopolis`) have no geophysical formation — but their
"process" is still a genuine **world-process that happens over time**, just
an **agentive** one: a biosphere or technosphere colonizing a world. So it
folds into the same L0→L1→L2 frame as a **parallel process track**, keeping
the model symmetric (everything is driver→process→feature). Drivers are
**D15 (habitability)** + **D16 (age, = time for life/tech to develop)**,
not erosion physics.

> **Compositing rule (the one thing that makes L1c special — a Phase-2
> directive, not a model break).** A biotic/technogenic process **coats an
> underlying base planet whose natural L0→L1→L2 chain still runs beneath
> it.** An ecumenopolis sits on what *was* a terrestrial world; a fungal
> world is a temperate ocean/terrestrial base with a living overlay. The
> representation should therefore be **base-type + overlay layer**, so the
> base world's oceans / weather / relief still show through wherever the
> overlay doesn't fully cover — not a from-scratch generator that throws
> the base away.

| ID | Process | Physical description | Drivers | Timescale signature | Intensity axis | Status |
|---|---|---|---|---|---|---|
| **P27** | Biospheric colonization | A surface biosphere spreads across habitable terrain, coating it in living mats / bioluminescent structures. | D15, D6, D1 (temperate), D16 | Ecological spread; coverage tracks biosphere maturity | sparse patches … planet-spanning mat | `[current]` (fungal spots) |
| **P28** | Technospheric development | A civilization develops and builds out, replacing/coating natural terrain with engineered structures and lighting the nightside; runs to planet-saturation (ecumenopolis). | D15→tech, D16, D7 (nightside lights) | Civilizational time; expansion to saturation | scattered structures/cities … planet-covering build-out | `[current]` (circuit grid, city lights, whole-surface glow) |

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
| **F1** | Mountains / ranges | P2, P3, P4 | tectonic fold belt (rock crumpled and pushed up where landmasses collide) · volcanic shield/strato (mountains built by lava — broad gentle domes or steep cones) · ridged crestlines (long sharp parallel spines of high ground) | Himalaya (Earth), Olympus Mons (Mars, the tallest known volcano), Tharsis (Mars, a giant volcanic bulge) | rocky, terrestrial, venus, lava, ice, carbon | `[aspirational]` |
| **F2** | Craters | P1 | simple bowl (small, smooth-sided pit) · complex (central peak with terraced walls) · peak-ring (a ring of peaks instead of one) · multi-ring basin (huge, with several concentric rings) · palimpsest (an old crater flattened nearly smooth) | Tycho (Moon), Orientale (Moon), Caloris (Mercury), Valhalla (Callisto, a moon of Jupiter) | rocky, ice, terrestrial, venus, carbon, machine, shattered, crystal | `[partial]` (basin height only) |
| **F3** | Ejecta & rays | P1 | continuous blanket (unbroken sheet of debris near the crater) · discontinuous (scattered, patchy debris farther out) · rampart (raised ridged rim, formed where ice or water made the debris flow like mud) · bright ray system (streaks of fresh material, only on airless worlds) · secondary fields (small craters made by chunks thrown out from the main impact) | Tycho rays (Moon), Mars ramparts | rocky, ice, terrestrial, machine, crystal | `[aspirational]` |
| **F4** | Canyons / rifts | P2, P8 | tectonic graben/chasma (a valley where the ground sank between cracks) · fluvial-incised gorge (a canyon carved by flowing liquid) · cryo-chasma (a deep rift in icy crust) | Valles Marineris (Mars), Grand Canyon (Earth), Charon chasmata (Pluto's moon Charon) | terrestrial, rocky, venus, ice, ocean | `[aspirational]` |
| **F5** | Scarps & fault systems | P2 | normal-fault cliff (a cliff where ground dropped along a crack) · lobate contraction scarp (a curved step where the crust squeezed and buckled) · wrinkle ridge (a long low wrinkle in hardened lava) · horst-and-graben province (a striped region of raised blocks and sunken valleys) | Discovery Rupes (Mercury), lunar maria ridges (the Moon's dark plains) | rocky, mercury-like, terrestrial, venus, ice | `[aspirational]` |
| **F6** | Plateaus / highlands / tessera | P2, P15 | uplift plateau (a broad raised tableland) · crustal-plateau tessera (highlands criss-crossed by a lattice of ridges and grooves) | Tibetan Plateau (Earth), Ovda Regio (Venus) | terrestrial, venus, rocky, hex, shattered | `[aspirational]` |
| **F7** | Volcanic edifices | P4, P5 | shield (broad, gently sloped dome from runny lava) · stratovolcano (tall, steep cone from sticky lava and ash) · caldera (big crater-like pit where the top collapsed) · pancake dome (flat-topped blob, forms under thick air) · corona/nova/arachnoid (round or web-like features pushed up by rising plumes of molten rock) | Mauna Loa (Earth, Hawaii), Sapas Mons (Venus), Venus coronae | rocky, terrestrial, venus, lava, carbon | `[aspirational]` |
| **F8** | Lava plains & flows | P4 | flood-basalt plain (vast sheet of cooled runny lava) · leveed channel (a lava river with built-up banks) · sinuous rille (a long winding lava groove) · collapsed tube/pit chain (a line of holes where a lava tunnel caved in) | lunar maria (the Moon's dark plains), Venusian canali (long lava channels on Venus), Io flows (lava on Jupiter's moon Io) | rocky, lava, venus, terrestrial, ice, machine | `[partial]` (lava cracks) |
| **F9** | Chaos / disrupted terrain | P2, P6, P7 | ice-shell chaos (rafts) (a frozen crust broken into tilted ice slabs) · volatile-outflow collapse (ground that caved in after underground ice or gas drained away) · antipodal seismic jumble (terrain shaken into rubble by a huge impact on the planet's far side) | Conamara Chaos (Europa, a moon of Jupiter), Caloris antipode (Mercury, the point opposite a giant crater) | ice, ocean, rocky, shattered | `[aspirational]` |
| **F10** | Ridged / grooved icy terrain | P2, P7 | double ridges (paired parallel ice ridges) · grooved bands (long stripes of furrowed ice) · lenticulae (diapirs) (lens-shaped blobs where warm ice pushed up) · refrozen-crack networks (old cracks that froze back over) | Europa (moon of Jupiter), Ganymede (moon of Jupiter), Enceladus (moon of Saturn) | ice, ocean | `[aspirational]` |

### F-gradational — water/wind/ice-shaped landforms
*Derives from: P8–P14. Existence gated by D6/P25 (need a retained
atmosphere + stable liquid) — an airless world skips this whole family.*

| ID | Feature | From | Variants | Examples | WD types | Status |
|---|---|---|---|---|---|---|
| **F11** | River networks & valleys | P8 | dendritic network (branching like the twigs of a tree) · meanders (slow looping S-curves across flat land) · single trunk (one main channel, few branches) · relict (degraded) (dried-up channels left from flows long gone) | Earth, Titan (Saturn's moon, where the rivers are liquid methane), Mars (relict — dry channels from ancient water) | terrestrial, ocean, ice, eyeball, carbon (hydrocarbon) | `[aspirational]` |
| **F12** | Deltas & alluvial fans | P8 | birdsfoot delta (river splits into finger-like channels) · fan (sediment spread in a wide cone) · coalesced bajada (several fans merged along a slope) | Titan deltas (a moon of Saturn), Mars fans | ocean, terrestrial, eyeball | `[aspirational]` |
| **F13** | Outflow / megaflood channels | P8 | streamlined-island scoured channel (a valley raked out by a giant flood, leaving teardrop-shaped islands) | Kasei Valles (Mars), Channeled Scablands (Washington State, Earth) | terrestrial, ice, ocean | `[aspirational]` |
| **F14** | Lakes & seas (standing liquid) | P8, P13 | water sea (liquid-water ocean) · methane/ethane sea (seas of cold liquid fuel-like chemicals) · dry playa/lakebed (a dried-up lake floor) | Earth oceans, Titan Kraken Mare (a methane sea on Saturn's moon Titan) | ocean, terrestrial, eyeball, carbon | `[partial]` (ocean-type water + islands) |
| **F15** | Dunes & wind forms | P9 | barchan (crescent-shaped dune) · linear (long straight ridge dunes) · star (many-armed dune from shifting winds) · yardang (rock ridge sculpted by wind) · ventifact (a rock polished and grooved by windblown sand) · wind streak (a smear of dust left downwind) | Namib (Earth), Titan dune belts (Saturn's moon Titan), Mars | terrestrial, venus, ice, carbon, lava (silicate sand) | `[aspirational]` |
| **F16** | Dust mantles | P9, P23 | thin veneer (a light dusting) · deep loess (thick wind-piled dust) · butterscotch haze tint (dusty air gives a tan-yellow color) | Mars dust mantle | terrestrial, venus, ice, rocky | `[aspirational]` |
| **F17** | Glacial landforms | P10 | ice sheet/glacier (thick slow-moving ice) · U-valley (a steep valley carved smooth by ice) · fjord (a flooded ice-carved coastal valley) · moraine (a ridge of rubble a glacier shoved aside) · esker (a winding gravel ridge left by meltwater) · polar layered deposits (stacked ice-and-dust layers at the poles) | Earth, Mars, Pluto N₂ glaciers (slow-moving frozen-nitrogen ice on Pluto) | ice, terrestrial, eyeball, ocean | `[aspirational]` |
| **F18** | Sublimation landscapes | P11 | pits/hollows (shallow holes left as ice turns straight to gas) · Swiss-cheese (terrain full of rounded holes) · bladed/penitente (tall thin blades or spikes of ice) · araneiform spiders (branching cracks carved by escaping gas) · convection polygons (slow-churning surface that cracks into a tile pattern) | Pluto Sputnik Planitia (Pluto's heart-shaped plain), Mars S-pole (Mars south pole) | ice, terrestrial, eyeball | `[aspirational]` |
| **F19** | Mass-wasting deposits | P12 | landslide lobe (tongue of fallen rock and dirt) · slump terraces (stair-like steps where ground slid down) · talus apron (skirt of loose rubble at a slope's base) · lobate debris apron (rounded ice-and-rock skirt that crept downhill slowly) | Valles landslides (Mars' giant canyon), Mars LDAs (icy debris skirts on Mars) | all rocky, ice | `[aspirational]` |
| **F20** | Coastlines | P13 | strandline/paleo-shoreline (an old high-water mark from a vanished sea) · sea cliff (steep face cut by waves) · beach/terrace (flat shelf left by the water's edge) | Earth, Titan lake margins (edges of Titan's lakes) | ocean, terrestrial, eyeball | `[aspirational]` |
| **F21** | Karst / dissolution | P14 | sinkhole/doline (a pit where the ground dissolved and dropped) · labyrinth maze (a tangle of dissolved grooves and ridges) · collapse lake (a pool that fills a sunken hollow) | Titan labyrinth (Saturn's moon), Earth limestone (caves and sinkholes in soluble rock) | terrestrial, ice, carbon, ocean | `[aspirational]` |

### F-volatile-surface — climate-painted surface patterns
*Derives from: P22 (the snowline / frost cycle). The bridge family between
climate and terrain.*

| ID | Feature | From | Variants | Examples | WD types | Status |
|---|---|---|---|---|---|---|
| **F22** | Polar caps & frost fields | P22, P10 | perennial water cap · seasonal CO₂ frost · N₂/CH₄ frost field · **eyeball nightside cap + terminator melt ring** | Earth, Mars, Triton, Pluto | terrestrial, ice, eyeball, rocky | `[partial]` (terrestrial/eyeball caps) |
| **F23** | Snowline / frost-coverage boundary | P22 | sharp coverage line (a crisp edge where frost begins) · diffuse tint (a soft, gradual frosting) · latitude vs. altitude band (frost set by how far north/south, or by how high up) | Earth snowline, Mars frost edge | rocky, ice, terrestrial, eyeball | `[aspirational]` |

### F-bands — atmospheric banding (the visible "surface" of gas worlds)
*Derives from: P16, P20, P21.*

| ID | Feature | From | Variants | Examples | WD types | Status |
|---|---|---|---|---|---|---|
| **F24** | Zonal belts & zones | P16 | high-contrast many-banded (bold stripes, like Jupiter) · soft few-banded (faint pale stripes) · bland blue + sparse CH₄ clouds (mostly featureless blue with thin methane clouds, like an ice giant) | Jupiter, Saturn, Neptune | gas, sub-neptune, hot-jupiter | `[current]` |
| **F25** | Jets & shear turbulence | P16 | equatorial superrotation jet (a fast wind band racing around the equator) · counter-rotating jet shear (neighboring wind bands sliding past each other in opposite directions) · festoon/scallop turbulence (wavy scalloped swirls where the winds churn) | Jupiter belt edges (the boundaries between Jupiter's cloud stripes) | gas, hot-jupiter, venus | `[partial]` (turbulence in gas-giant) |
| **F26** | Latitude weather bands (terrestrial) | P20 | Hadley/Ferrel zonation (stacked bands of wind that circle the planet) · ITCZ/monsoon convergence band (a rainy belt where winds meet near the equator) | Earth | terrestrial, ocean, eyeball | `[lab]` |

### F-storms — vortices & discrete storms
*Derives from: P17.*

| ID | Feature | From | Variants | Examples | WD types | Status |
|---|---|---|---|---|---|---|
| **F27** | Great-spot anticyclone | P17 | single giant oval (one enormous swirling storm) · dark spot (a darker storm patch) | Jupiter GRS (the Great Red Spot), Neptune GDS (the Great Dark Spot) | gas, hot-jupiter | `[current]` (single) |
| **F28** | Storm clusters / oval trains | P17 | white-oval train (a row of pale storm ovals) · "string of pearls" (storms lined up like beads) · convective plume outbreak (a sudden burst of towering storm clouds) | Jupiter ovals, Saturn GWS (Saturn's Great White Spot) | gas, hot-jupiter, sub-neptune | `[partial]` (`storms.spots` generated, unwired) |
| **F29** | Polar vortex | P17 | single cyclonic cap (one big swirling storm over the pole) · polygonal jet (a wind stream bent into straight sides, like Saturn's hexagon) · cyclone-cluster lattice (a tidy ring of storms forming a pentagon or hexagon) | Saturn hexagon (six-sided polar jet), Jupiter poles, Venus | gas, venus, eyeball, hex | `[partial]` (polar darkening only) |
| **F30** | Lightning / electrical storms | P17 | flash clusters in convective regions (bursts of lightning where storm clouds boil upward) · sprites (faint red flashes high above the storm — subtle) | Jupiter, Saturn, Earth | gas, sub-neptune, terrestrial, ocean | `[aspirational]` |

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
| **F32** | Dayside thermal hotspot | P21 | warm dayside (the sunlit face runs hot) · glowing molten-bright dayside (a dayside so hot it glows) · eastward-shifted hotspot (superrotation) (the hottest spot blown east by fast winds) | HD 209458 b (a hot gas planet around a distant star), WASP-43 b (a scorching gas planet around a distant star) | hot-jupiter | `[current]` (day-side thermal) |
| **F33** | Nightside thermal glow | P21 | dim self-emission (a faint heat-glow on the dark side) plus patchy mineral/silicate clouds (clouds made of rock-vapor) | ultra-hot Jupiters (scorching giant exoplanets) | hot-jupiter | `[current]` (night-side glow) |

### F-optical — limb, terminator, glint, aurora
*Derives from: P24, P26.*

| ID | Feature | From | Variants | Examples | WD types | Status |
|---|---|---|---|---|---|---|
| **F34** | Limb / atmosphere rim glow | P26 | fresnel rim (a thin bright outline of light along the edge) · blue line (the thin blue glow of air seen edge-on) · thick haze halo (a fuzzy ring of haze around the planet) | Earth blue line (the blue band seen from orbit), Titan | all atmospheric types | `[current]` (fresnel limb) |
| **F35** | Terminator color gradient | P26 | reddened day/night boundary (the line between day and night glows red) · twilight band (a soft dusk-colored strip) | Earth sunsets, Mars blue sunsets | terrestrial, rocky, venus | `[current]` (terminator day/night) |
| **F36** | Sunglint off liquid | P26 | sharp specular spot on water / methane sea (a bright mirror-like glare where sunlight bounces off a liquid surface) | Earth glint (sun reflecting off the ocean), Titan Kraken glint (sunlight off Titan's largest methane sea) | ocean, terrestrial, eyeball | `[aspirational]` (no specular glint in pipeline) |
| **F37** | Aurorae | P24 | polar ovals (glowing oval halos over the poles) · ring latitude/width by field strength (how big and how far from the pole the glow sits depends on the magnetic field) | Earth, Jupiter, Saturn | terrestrial, gas, ocean, city-lights | `[current]` (physics-gated) |
| **F38** | Airglow / nightglow limb band | P24 | faint diffuse night-limb ring | Earth airglow | terrestrial, ocean, venus | `[subtle]` |
| **F39** | Cloud optics (rainbows / glories) | P26 | colored arcs/rings of uniform-droplet clouds | Earth rainbows, Venus glory | terrestrial, ocean, venus | `[subtle]` |

### F-dust — aeolian atmospheric features
*Derives from: P23.*

| ID | Feature | From | Variants | Examples | WD types | Status |
|---|---|---|---|---|---|---|
| **F40** | Dust storms | P23 | dust devil tracks (squiggly trails left by small whirlwinds) · regional dust front (a dust wall sweeping one area) · planet-encircling global storm (dust wrapping the whole world) | Mars | rocky, terrestrial (arid), venus | `[partial]` (optional Mars dust storms) |

### F-exotic-natural — speculative natural endmembers
*Derives from: P4/P6 (extreme heat), P15 (crystallization/fracture), D10
(carbon chemistry). Flagged confidence: anticipated → speculative.*

| ID | Feature | From | Variants | Examples | WD types | Status |
|---|---|---|---|---|---|---|
| **F41** | Hemispheric magma ocean | P4, P6, D7, D1(extreme) | molten dayside sea (an ocean of liquid rock on the sun-facing side) · magma shoreline/waves at terminator (lava coast and waves where day meets night) · nightside rock-frost condensate plains (plains where vaporized rock freezes out on the dark side) | K2-141b (candidate lava world), 55 Cnc e (candidate lava world) | lava, eyeball | `[aspirational]` *(speculative)* |
| **F42** | Carbon-world crust | D10 | graphite plain (flat fields of pencil-lead carbon) · diamond-studded ridges (ridges sparkling with diamond) · hydrocarbon/tar flats (sticky oily-black plains) | hypothesized carbon planets (a proposed planet type, none confirmed yet) | carbon, crystal, rocky | `[aspirational]` *(speculative)* |
| **F43** | Crystalline facet field | P15 | scattered crystals (a few glinting crystal patches) … continuous faceted field (a whole surface of flat shiny crystal faces) | none confirmed | crystal, carbon, lava (cooled) | `[aspirational]` *(speculative)* |
| **F44** | Hexagonal-tessellated crust | P15 | small polygons (little many-sided tiles) … planet-wide hex tiling (six-sided tiles covering the whole world) | basalt columns (cooled-lava pillars on Earth), Pluto polygons (small analogs) (smaller tile-like patterns seen on Pluto) | hex, rocky, ice | `[aspirational]` *(speculative)* |
| **F45** | Shattered / fractured crust | P15 | local fracture zone (cracking in one area) … globally shattered blocks (the whole crust broken into pieces) | Miranda (analog) (a moon of Uranus with jumbled terrain) | shattered, rocky, ice | `[aspirational]` *(speculative)* |

### F-overlay — artificial / biotic surface coatings
*These four EXOTIC types have **no geomorphic formation** — they derive
from the **L1c biotic/technogenic process track (P27, P28)** and
**composite over a natural base planet** (see the L1c callout and Appendix
A note). Confidence: speculative game-construct.*

| ID | Feature | From | Variants | Examples | WD types | Status |
|---|---|---|---|---|---|---|
| **F46** | Bioluminescent / fungal mats | P27 | sparse patches (scattered glowing or fungal spots) … planet-spanning living mat (a single living layer wrapped around the whole world) | none confirmed | fungal | `[current]` (bioluminescent spots) |
| **F47** | Machine / structured surface | P28 | scattered structures (a few built objects dotting the surface) … fully machined crust (the whole surface turned into a circuit-like grid) | Dyson-tier hypothetical (imagined mega-engineered worlds, none known to exist) | machine | `[current]` (circuit grid) |
| **F48** | City lights | P28 (+D7 nightside) | scattered cities (isolated points of light) … continuous urban band (lights merging into one glowing strip); lit nightside (the dark half of the world dotted with light) | Earth-at-night (nascent — just beginning to appear) | city-lights, eyeball (nightside cities) | `[current]` (night-side city lights) |
| **F49** | Ecumenopolis | P28 (saturation) | planet-covering megacity (whole-surface glow) (a single city wrapping the entire planet, lit up all over) | fictional (Coruscant) (the city-planet from Star Wars) | ecumenopolis | `[current]` (whole-surface city glow) |

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

> **Overlay-type design note (Phase-2 input — RECOMMENDED FOLD).**
> `fungal`, `machine`, `city-lights`, and `ecumenopolis` fold in as the
> **L1c biotic/technogenic process track (P27, P28)**, driven by D15 + D16
> — *not* as a special case outside the model, and *not* as from-scratch
> landform generators. The representation is **base-type + overlay layer**:
> the overlay composites over a natural base planet (an ecumenopolis over a
> terrestrial world) whose own L0→L1→L2 chain still runs beneath, so base
> oceans / weather / relief show through where the overlay doesn't cover.
> `hex`, `crystal`, and `shattered` are different — those have plausible
> *natural* physical premises (P15) and are driven by real L0 params, no
> overlay needed.

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

## Build sequence — the new planet rendering system

This inventory is the **WHAT accounting** — the meta-prerequisite, now
complete. It feeds a **ground-up new rendering system** that supports real
LOD (the current system renders only 1 LOD beyond billboards). The new
system builds **up** in complexity from the existing 1-LOD aesthetic
foundation, keeps the retro/dithered envelope, and is wired **feature by
feature**, each feature **driver-derived** (the `type`-int ladder in
`Planet.js` does *not* carry forward — types become the Appendix-A
driver-bundle presets). It exists to **change** the visuals, so there is
**no parity-with-current goal**.

The build is a pipeline:

1. **Stage A — Finish the foundational / architectural research (gate, do
   first).** The cross-cutting foundation every feature plugs into, before
   any single feature is built. Two parts:
   - **Resolve the gating decisions** that are Max's calls — the
     retro-envelope **A/B/C decision** first (`RESEARCH_high-lod-planet-shaders`
     §2, the spine of everything), then §6's open questions (sphere
     flow-frame, crater Voronoi, posterizer level, mega-shader-vs-variants,
     LOD2 scope, civilized bodies).
   - **Lock the base architecture** — analytic-derivative noise base, the
     `lodRamp` scalar + hysteresis, variable-octave FBM + fwidth clamp, and
     the **driver→semantic-uniform scaffolding** (extend the existing
     aurora/atmosphere precedent — derive L1 params CPU-side in the
     generator, pass as semantic uniforms; this is the generation-side
     foundation) — the shared base all features build up from.
2. **Stage B — Per-feature research, by domain.** For each feature/domain,
   research **both** (a) how to **render** it (the HOW, extending the
   research spec) **and** (b) how to **generate** it / make its driving
   data available to the renderer (which `D#` drivers → which `P#` process
   computes the param → how it reaches the shader). Domains ≈ this doc's L2
   families (relief, fluvial, aeolian, cryo/sublimation, bands/storms,
   clouds/haze, optical, exotic/overlay).
3. **Stage C — Implement in parallel in the lab.** As each major research
   domain completes, **begin implementing its features in
   `world-engine-lab.html` in parallel** (while the next domain's research
   proceeds). Isolated-harness-first (per MEMORY rule); verify visually via
   chrome-devtools :9223.

**Carry-forward notes:**
- *Generation-side is first-class.* "How each feature is generated and made
  available to the rendering system" is part of Stage-B per-feature
  research — the old "representation/data-management" concern lives here
  (per-feature) plus in the Stage-A scaffolding (foundation), not as a
  separate abstraction. Surfacing the **magnetic-field driver (D13)** as a
  first-class planet-data field is one such item.
- *Rotation-rate exposure* — `rotationSpeed` exists (`:697`); confirm it
  reaches any band/jet derivation.
- *Posterization triage* — the `[subtle]` features (F38, F39, sprites, UV
  Y-markings) need an explicit keep/stylize/drop call when their domain
  comes up — don't spend relief budget on effects the 6-level envelope
  crushes.
