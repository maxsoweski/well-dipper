# World-Engine Architecture Spine — L1 engine stack (DRAFT, pending story-lens review)

**Status:** DRAFT, 2026-06-22. Converged in-thread this session; **pending** (a) a story-lens review
answering Max's 3 questions (below) and (b) Max's convergence on tiers + the L0-gap resolution. After that →
WF2 by-engine research fans out per engine. **Nothing here is locked except the items in §5.**

This is the **engines** half of the world-engine effort. Its sibling is the **outcomes** half:
[`world-engine-outcomes-catalog.md`](world-engine-outcomes-catalog.md) (committed `75681a7`, 125 net-new +
84 candidate engines). Strategic frame: [`planet-lod-CHARTER.md`](planet-lod-CHARTER.md) (NORTH STAR =
co-dependence; lab≠game). The deferred "Phase 2" of [`planet-visual-features.md`](planet-visual-features.md)
(how L0→L1→L2 gets stored + fed so features derive from drivers, not type-branches) **is this layer.**

## 0. The frame — a "story engine" (Max's words, 2026-06-22, preserve don't soften)

> "Looking at any planet/moon, what you see (what 'renders') is the billions-of-years history of that object
> and its relationships with other objects in the system. So the generative world engine is a kind of 'story
> engine' that determines the history/story of the world in question, and users 'read' the story by looking at
> it — by scanning it and reading its properties."

Design consequence: when the engine stack runs, it must produce a surface that encodes a **coherent,
causally-ordered history**. The dependency order of the engines is therefore not just a compute order — it is
**time's arrow**. Anything out of causal/temporal order produces an incoherent story (a body that "reads" wrong).

Slop diagnosis (prior session, still valid): today each feature is an independent overlay on a blank canvas →
a "bag of toggled effects." Real bodies look distinctive because features share **engines** rooted in the
body's history, composition, and place in the system. Feature count should FALL (the catalog's 84 candidate
engines collapse to ~15 roots). Borrow settled planetary-science scaling to *place* plausible structure once
per body; do NOT time-step billions of years.

## 1. The three-layer model

- **L0 — galaxy engine (exists).** Input boundary. Per **system**: star + metallicity + system architecture
  (orbits, neighbors, moons, rings). Per **body**: the D1–D16 driver vector (`planet-drivers.js`), computed in
  `src/generation/PhysicsEngine.js` + `PlanetGenerator.js` from the system/star.
- **L1 — world-engine layer (NEW — this doc).** The ~15 engines that take L0's outputs and emit the fields +
  features. **render expresses, procgen decides.**
- **L2 — feature renderers (mostly exist; shaders sound).** Consume L1's fields instead of independent noise +
  dice rolls. The renderer's job shrinks to *expressing* the simulation.

## 2. L0 interface — what the galaxy engine hands down (from `planet-drivers.js`)

Per-body driver vector **D1–D16** (all **scalars/small vectors** — see the gap in §4):

| D | key | role |
|---|-----|------|
| D1 | tempEq | equilibrium temp; master volatile/habitability gate |
| D2 | volatileFraction | frost-line volatile/ice budget |
| D3 | axialTilt | obliquity → seasons, polar-cap cycling, frost-line latitude |
| D4 | atmoComposition | n2-o2 / co2 / h2-he / none → cloud species, haze, sky color |
| D5 | atmoDensity | pressure → wind transport, opacity, pressure-gated volcanism |
| D6 | atmoRetention | Jeans escape + UV stripping (gated by D13) |
| D7 | tidalLock | eyeball climate, substellar magma, terminator rings |
| D8 | rotation | zonal banding, jets, Coriolis storms |
| D9 | ironFraction | core iron → magnetic field (D13) + surface mineralogy |
| D10 | carbonToOxygen | C/O → carbon-planet surfaces |
| D11 | surfaceHistory | impact flux + resurfacing budget → terrain age |
| D12 | tidalHeating | interior heat → resurfacing, cryovolcanism, Io-grade volcanism |
| D13 | magneticField | ironFraction × rotation — GATE for aurora + retention |
| D14 | massGravity | crater morphology, shield scale, dune repose |
| D15 | habitability | composite liveability → biotic + artificial overlays |
| D16 | age | weathering time, crater accumulation, bio/technosphere development |

L0 also computes (but does not currently expose to the planet pipeline) the **system graph**: sibling bodies,
star, moons, rings, orbital resonances. This under-exposure is half the gap (§4).

## 3. The engine stack — 15 engines, 5 tiers (headline `in → out`)

**Tier 1 · Body-defining** (consume L0 only; decide *what kind of world this is* → gate which engines below fire)
- **E1 Composition & regime** — D2/D9/D10/D14/atmo → composition class + bulk regime (rocky/icy/carbon/iron/ocean/gas-giant/magma-ocean/stripped-core) + base palette
- **E2 Figure & illumination** — D7/D8/D14/orbit/star → shape (sphere/triaxial/Roche/comet-tail/ringworld) + lighting regime (terminator/eyeball/rogue-thermal/pulsar)

**Tier 2 · Forcing fields** (consume L0 + T1; emit fields many engines read)
- **E3 Tidal / orbital-coupling** — D7/D12/orbit(ecc,libration)/neighbors → rotating stress-tensor field + tidal-heat-flux field
- **E4 Magnetosphere / radiation** — D13(+topology)/neighbors/D4 → charged-particle flux mask + field topology + aurora/airglow
- **E5 Atmosphere / climate** — D4/D5/D8/D1/D3 → bands/storms/clouds/haze + wind field + sky optics *(terminal surface for gas giants; forcing+sky for terrestrials)*

**Tier 3 · Surface-building / relief** (consume L0 + T1 composition + T2 forcing)
- **E6 Lithospheric-stress / tectonic-grain** — D11/D12/D14/composition/despin → **structural-grain field** (orientation+wavelength+amplitude) + relief (ranges, rifts, scarps, plateaus, grooves, tessera)
- **E7 Endogenic-heat / magmatism** — D12+tidal-heat/D14/D5/composition(fluid) → thermal-emission+age field + volcanic landforms (placed by a hotspot field) + magma-ocean/cryovolcanic systems
- **E8 Impact / bombardment & space-weathering** — D11/D14/D5/D2/D16/composition(target) → crater population + ejecta + regolith-maturity field + nanophase-albedo field

**Tier 4 · Surface-sculpting / gradational** (consume T3 relief + T2 forcing + L0 fluid drivers — *North-Star couplings live here*)
- **E9 Hydrology / working-fluid** — relief/D1/D2(fluid)/D14/D8 → drainage + base-level field + shorelines + deltas + outflow + karst + standing-liquid field
- **E10 Aeolian** — relief/D5/D14/D2(grain)/D8(wind-rose)/frost-gate → sediment-flux field → dunes/yardangs/streaks + dust-budget field
- **E11 Cryosphere / volatile-ice** — D1/D2/D3/D12/relief/E3-stress-tensor → ice-shell convection + sublimation + glacial mass-balance + frost cycle (gates E10) + cryotectonic resurfacing

**Tier 5 · Modality / coherence overlay** (read everything below; emit body-wide fields + final readouts — *where "reads as one world" is assembled*)
- **E12 Surface-chemistry & province** — composition/irradiation(E4)/T/all-surface-fields → body-wide hue/palette field + whole-disk compositional-province field
- **E13 Temporal / transient** — D3/D1/frost+dust+ice+ring states → seasonal/time-varying overlay (RSL, frost flush, dust-clearing, spokes)
- **E14 Inhabitation** — D15/D16 → biosignature tint + technosignature structures/overlays
- **E15 Ring / circumplanetary** — system(rings/moons)/D13 → rings + ring-shadow band + spokes + ring-rain inflow

## 4. The L0-gap finding (the "system-determining inputs" question)

The current L0→L1 interface is **per-body scalars (D1–D16)**, but the co-genesis engines need two things those
scalars structurally cannot carry:

1. **Structured fields, not scalars.** E6 needs a lineament-*orientation* field; E3 a stress *tensor*; E4 a
   field *topology* map (D13 is a lone scalar strength); E8 a resurfacing-event *sequence* (D11 is a scalar
   age). Co-genesis *is* shared structured fields — and L0 hands down points.
2. **System-level context, not per-body.** E15 (rings), E14/E4 (moon-footprint aurora), E3 (tidal heating,
   binary volatile-exchange) need the **system graph** (moons, rings, companion, resonances). D1–D16 are
   per-body and never expose neighbors. This is the literal content of "the galaxy engine's outputs which
   determine systems."

**Working lean (NOT locked):** L0 stays the scalar source but **exposes the system graph it already computes**;
a thin Tier-1 base step in L1 **derives the structured fields** (orientation seeds, stress tensor, field
topology, resurfacing sequence) from D1–D16 + that graph. WF2's per-engine pass produces the precise gap list.

## 5. Locked decisions (carry forward)

- WF1 outcomes catalog reconciled → **125 net-new + 84 candidate engines** (committed `75681a7`).
- WF2 fans out **by engine** (not by feature). All 4 grounding tiers tagged. Two-workflow sequence with a Max
  review checkpoint between (passed; clean-first reconciliation done).
- Engine collapse done **in-thread** (here), not by a workflow agent (dodges the runner wedge); WF2 fans out
  per **approved** engine to do deep per-engine research.
- This is a **brainstorm**, not a build. No `dev-collab-scope`, no build/verify workflow yet.

## 6. Open — the story-lens review questions (Max, 2026-06-22) + what's next

Under review by a background agent team:
1. **Sufficiency** — do the 15 engines get everything they need from the galaxy engine (L0)?
2. **Over-supply / conflict** — do they get *more* than they need? I.e. assumptions baked into the galaxy
   generator (esp. `planet-archetypes.js` **type presets**) that pre-decide things the world engine should
   itself derive (the co-genesis-vs-type-branch tension).
3. **History ordering** — does the current tiering reconstruct a coherent billions-of-years *history* when
   read off the surface? Is anything **out of order** through that lens?

Still to converge with Max: tier assignments (candidate re-slots: E3 forcing-vs-relief; E5 forcing-vs-terminal;
E12 modality-vs-body-defining; E2 base-vs-render-frame-sidecar) and the L0-gap resolution (§4: expose+derive vs
extend-L0 vs decide-after-WF2-gap-list). **Then** WF2 by-engine research → DAG → feasibility/budget triage →
first vertical slice (Max's recurring case: terrain↔sea-level↔drainage).
