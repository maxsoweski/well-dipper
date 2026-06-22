# World-Engine Architecture Spine — L1 engine stack (story-lens review folded in)

**Status:** 2026-06-22. Converged in-thread + story-lens review **DONE and folded in** (§3.1, §4). The only
still-open structural choice is the **L0-gap resolution** (§4c); final tier sign-off is Max's UAT. After that →
WF2 by-engine research. **This is a BRAINSTORM, not a build** — no `dev-collab-scope`, no build/verify workflow yet.

This is the **engines** half of the world-engine effort. Sibling = the **outcomes** half:
[`world-engine-outcomes-catalog.md`](world-engine-outcomes-catalog.md) (committed `75681a7`; 125 net-new + 84
candidate engines). Strategic frame: [`planet-lod-CHARTER.md`](planet-lod-CHARTER.md). Story-lens audits:
[`world-engine-L0-audit.md`](world-engine-L0-audit.md), [`world-engine-history-ordering-audit.md`](world-engine-history-ordering-audit.md).
Master pickup: [`world-engine-INDEX.md`](world-engine-INDEX.md). The deferred "Phase 2" of
[`planet-visual-features.md`](planet-visual-features.md) **is this layer.**

## 0. The frame — a "story engine" (Max's words, 2026-06-22, preserve don't soften)

> "Looking at any planet/moon, what you see (what 'renders') is the billions-of-years history of that object
> and its relationships with other objects in the system. So the generative world engine is a kind of 'story
> engine' that determines the history/story of the world in question, and users 'read' the story by looking at
> it — by scanning it and reading its properties."

Design consequence: when the engine stack runs it must produce a surface that encodes a **coherent,
causally-ordered history**. The dependency order of the engines is therefore **time's arrow** — anything out of
causal/temporal order produces a body that "reads" wrong. Slop diagnosis (still valid): today each feature is an
independent overlay → a "bag of toggled effects." Real bodies look distinctive because features share **engines**
rooted in the body's history, composition, and place in the system. Borrow settled planetary-science scaling to
*place* plausible structure once per body; do NOT time-step billions of years.

## 1. The three-layer model

- **L0 — galaxy engine (exists).** Input boundary. Per **system**: star + metallicity + system architecture
  (orbits, neighbors, moons, rings). Per **body**: the D1–D16 driver vector (`planet-drivers.js`), computed in
  `src/generation/PhysicsEngine.js` + `PlanetGenerator.js`.
- **L1 — world-engine layer (NEW — this doc).** The ~15 engines that take L0's outputs and emit fields + features.
  **render expresses, procgen decides.**
- **L2 — feature renderers (mostly exist; shaders sound).** Consume L1's fields instead of independent noise + dice.

## 2. L0 interface — what the galaxy engine hands down (from `planet-drivers.js`)

Per-body driver vector **D1–D16** (all **scalars/small vectors** — see §4):

| D | key | role |
|---|-----|------|
| D1 | tempEq | equilibrium temp; master volatile/habitability gate |
| D2 | volatileFraction | frost-line volatile/ice budget |
| D3 | axialTilt | obliquity → seasons, polar-cap cycling |
| D4 | atmoComposition | cloud species, haze, sky color |
| D5 | atmoDensity | wind transport, opacity, pressure-gated volcanism |
| D6 | atmoRetention | Jeans escape + UV stripping (gated by D13) |
| D7 | tidalLock | eyeball climate, substellar magma, terminator rings |
| D8 | rotation | zonal banding, jets, Coriolis storms |
| D9 | ironFraction | core iron → magnetic field (D13) + mineralogy |
| D10 | carbonToOxygen | carbon-planet surfaces |
| D11 | surfaceHistory | impact flux + resurfacing budget → terrain age |
| D12 | tidalHeating | interior heat → resurfacing, cryo, Io-grade volcanism — **NOTE: hard-zeroed in game, see §4a** |
| D13 | magneticField | ironFraction × rotation — GATE for aurora + retention |
| D14 | massGravity | crater morphology, shield scale, dune repose |
| D15 | habitability | composite → biotic + artificial overlays |
| D16 | age | weathering time, crater accumulation, bio/technosphere |

L0 also computes (but does NOT expose to the planet pipeline) the **system graph**: siblings, star, moons, rings,
resonances. That under-exposure is half the gap (§4a).

## 3. The engine stack — 15 engines / 5 tiers, post-review (headline `in → out`)

**Tier 1 · Body-defining** (consume L0 only; decide *what kind of world* → gate which engines fire)
- **E1 Composition & regime** — D2/D9/D10/D14/atmo → composition class + bulk regime (rocky/icy/carbon/iron/ocean/gas-giant/magma-ocean/stripped-core) + base palette. **Now also outputs the "type" as a DERIVED LABEL (§4b).**
- **E2-figure Body figure** — D7/D8/D14/orbit/tidal → body shape (sphere/triaxial/Roche/comet-tail/ringworld). *(Illumination split OUT → render-frame sidecar, below.)*
- **E12-province Compositional province** — composition + gross structure → whole-disk latitudinal/hemispheric **province field** (Titan Xanadu, Io zonation). *(Moved here from Tier 5 per review — province is set early; palette stays terminal.)*

**Tier 2 · Forcing fields** (consume L0 + T1; emit fields many engines read)
- **E3 Tidal / orbital-coupling** — D7/D12/orbit(ecc,libration)/neighbors → rotating stress-tensor field + tidal-heat-flux field
- **E4 Magnetosphere / radiation** — D13(+topology)/neighbors/D4 → charged-particle flux mask + field topology + aurora/airglow
- **E5 Atmosphere / climate** — D4/D5/D8/D1/D3 → bands/storms/clouds/haze + wind field + sky optics *(terminal surface for gas giants; forcing+sky for terrestrials)*

**Tier 3 · Surface-building / relief** (consume L0 + T1 composition + T2 forcing)
- **E6 Lithospheric-stress / tectonic-grain** — D11/D12/D14/composition/despin → **structural-grain field** + relief (ranges, rifts, scarps, plateaus, grooves, tessera)
- **E7 Endogenic-heat / magmatism** — D12+tidal-heat/D14/D5/composition(fluid) → thermal-emission+age field + volcanic landforms (hotspot-placed) + magma-ocean/cryovolcanic systems
- **E8a Bombardment** — D11/D14/D5/D2/composition(target) → crater population + ejecta + crater morphology. *(Space-weathering split OUT → E8b in Tier 5; it ages the FINISHED surface.)*

**Tier 4 · Surface-sculpting / gradational** (consume T3 relief + T2 forcing + L0 fluid drivers — *North-Star couplings*)
- **E9 Hydrology / working-fluid** — relief/D1/D2(fluid)/D14/D8 → drainage + base-level field + shorelines + deltas + outflow + karst + standing-liquid field
- **E10 Aeolian** — relief/D5/D14/D2(grain)/D8(wind-rose)/frost-gate → sediment-flux field → dunes/yardangs/streaks + dust-budget field
- **E11 Cryosphere / volatile-ice** — D1/D2/D3/D12/relief/E3-stress-tensor → ice-shell convection + sublimation + glacial mass-balance + frost cycle (gates E10) + cryotectonic resurfacing

**Tier 5 · Modality / coherence overlay** (read the FINISHED surface; emit body-wide fields + late readouts)
- **E8b Space-weathering / regolith-maturity** — finished surface + D16 age + E4 flux → nanophase-iron albedo/maturity field (sets+fades ray brightness; lunar swirls = this masked by E4). *(Late, cumulative — moved here from E8.)*
- **E12-palette Surface-chemistry palette** — composition/irradiation(E4)/T/all-surface-fields → body-wide **hue/palette field**
- **E13 Temporal / transient** — D3/D1/frost+dust+ice+ring states → seasonal/time-varying overlay (RSL, frost flush, dust-clearing, spokes)
- **E14 Inhabitation** — D15/D16 → biosignature tint + technosignature structures/overlays
- **E15 Ring / circumplanetary** — system(rings/moons)/D13 → rings + ring-shadow band + spokes + ring-rain inflow

**Render-frame SIDECAR** (NOT a tier — modifies how every tier reads, not a step in the history chain)
- **E2-illumination** — D7/star/host → lighting regime (terminator / eyeball-locked / rogue-starless thermal-only / compact-object-pulsed). Pulled out of E2 per review.

## 3.1 Model-level additions from the story-lens review (the two findings tiers alone can't hold)

**The EPOCH / host-editor evaluation model (the central history fix — REQUIRED). ✅ LOCKED 2026-06-22.** Max
delegated the technical call; criterion = "easiest-to-optimize path toward the story-engine north star." Rationale:
a flat one-pass stack *structurally cannot* encode on-patch history sequences, so you cannot optimize toward a star
the architecture can't reach — this is the minimum structure that makes the star reachable. Keep it MINIMAL: the
coarsest epoch granularity (2–4) that still encodes the sequences that matter, NOT billion-year time-stepping. A flat "each engine runs once
in tier order" model **cannot** represent event-sequences on one patch: crater later intruded by magma (floor-
fractured crater), channel later exhumed into an inverted ridge, dune later frost-locked, fresh ray later space-
weathered. The catalog itself calls for "engines that compose over each other's outputs" and "a crater is a
persistent HOST edited by later engines." Fix (**not** billion-year time-stepping): run the tier stack over **2–4
named EPOCHS**, and let later engines act as **EDITORS that modify earlier engines' outputs on a patch** (the
host). A thin evaluation-model layer over the tiers. The tiers give time's coarse arrow; epochs+editors give the
on-patch sequences.

**Two genuine cross-tier CYCLES a one-pass DAG can't express** (resolve, don't ignore):
- **atmosphere ↔ surface** — shared dust/frost budget (E5↔E10/E11). Resolve via a **shared feedback field** taken
  to a fixed point, not a one-way edge.
- **figure ↔ grain** — despin/TPW produces a *second generation* of lineaments offset from the first
  (E2-figure → E6). Resolve via the **epochs** (gen-1 grain early, gen-2 after reorientation).
- (tidal-heat↔volcanism and base-level↔fluvial are intra-engine → "place once at a representative epoch" / a local
  fixed point, not cross-tier cycles.)

**Bonus finding:** nothing in the codebase currently encodes time's-arrow ordering — `planet-feature-associations.js`'s
`dependsOn.features` is RENDER-mask order, not history order. This spine is the first artifact that encodes history.

## 4. The L0 interface — what's BROKEN (under-supply) and what CONFLICTS (over-supply)

Story-lens L0 audit (`world-engine-L0-audit.md`) found the L0→L1 interface fails in BOTH directions. Findings are
agent-reported with file:line cites — **spot-check before acting.**

### 4a. UNDER-supply — the boundary is broken, not just thin (10 of 15 engines starved)
Only E1 + E5 are cleanly sufficient. Beyond "scalars can't carry structured fields," key drivers are literally
**dead or dropped** in the game pipeline — a concrete **plumbing track**, not an abstraction:
1. **D12 tidalHeating is hard-zeroed** (`PlanetGenerator.js:565`; real fn runs only in tests) → starves the whole
   tidal/cryo/endogenic spine (E3/E6/E7/E11).
2. **No per-body system context** — `planetData` has no handle to siblings/moons/rings/companion/resonances →
   starves E15 entirely + E4/E13/E2/E3. (L0 computes the graph one level up; it just isn't exposed.)
3. **D13 magneticField** computed inline twice, never surfaced; **eccentricity** never computed (dead
   `circularize`); **D16 age + metallicity** computed-then-dropped. (3–5 are ~one-line plumbing fixes.)
- Plus the structural-field gap: engines need an orientation field / stress tensor / field-topology map /
  resurfacing-event sequence that scalars can't carry.

### 4b. OVER-supply — "type" is load-bearing at the input boundary, against co-genesis
The galaxy engine picks a discrete **type FIRST, before any driver**, then hard-codes outcomes from type lookup
tables (`_pickType` → palette/atmosphere/moons/rings; `computeAtmosphere` hard-codes D4/D5/D6 by type;
`planet-archetypes.js` `rendersOn` allowlists gate the **feature set per named preset** — chaos/cryoRidge fire
because a body *is "Europa,"* not from its drivers). Also: D13/D15 are derived composites computed at L0 then
discarded (layering inversion); the lab's `DRIVER_PRESETS` is a parallel type-first contract diverging from the
game; `ExoticOverlay` re-rolls a type post-hoc and regenerates, **erasing derived history**.
- **Resolution principle (adopted):** **demote "type" from a load-bearing INPUT to a derived LABEL** — an output of
  E1, a name read off the result, never a thing that pre-decides features. Drivers decide; type names.

### 4c. The L0-gap resolution — ✅ RESOLVED 2026-06-22: EXPOSE + DERIVE (Option A)
Max delegated the technical call (criterion = easiest-to-optimize path toward the story-engine north star).
**Decision:** L0 stays the scalar source but **exposes the system graph it already computes**; a new thin Tier-1
**base step in L1 derives the structured fields** (orientation fields, stress tensors, field-topology maps).
Rationale against the criterion: (1) derivation IS the history-writing work → it belongs in the NEW L1 layer by
definition; (2) lowest blast radius — does not edit the fragile, most-depended-on PlanetGenerator/PhysicsEngine
core (§7 caution), so it's the cheapest layer to iterate/optimize; (3) gives WF2 a concrete boundary to design
against; (4) NOT premature — fixes *where* derivation lives, not *what* fields (WF2 still produces the per-engine
field list). The **plumbing track is UNCONDITIONAL** (un-zero D12, compute eccentricity, surface D13/D16/metallicity,
expose the system graph) and happens under any option — WF2 writes its precise spec (spot-check the agent-reported
file:line cites before editing).

## 5. Locked decisions

- WF1 outcomes catalog reconciled → **125 net-new + 84 candidate engines** (`75681a7`).
- WF2 fans out **by engine** (not feature). All 4 grounding tiers tagged. Two-workflow sequence with a Max review
  checkpoint between (passed; clean-first reconciliation done).
- Engine collapse done **in-thread** (dodges the runner wedge); WF2 fans out per **approved** engine.
- Story-lens review **done**; its findings folded into §3.1 + §4.
- **Epoch / host-editor model LOCKED** (2026-06-22) + **tier re-slots LOCKED** (E8a bombardment / E8b space-weathering split; E2-illumination → render-frame sidecar; E12-province → T1, palette stays terminal).
- **L0-gap RESOLVED → Option A (expose + derive)** (§4c); the plumbing track is unconditional.
- All locks made by working-Claude under Max's explicit delegation of the technical calls; criterion = easiest-to-optimize toward the story-engine north star.

## 6. Status & what's next

**Status (2026-06-22):** all structural choices LOCKED — epoch/host-editor model, tier re-slots, and the L0-gap
(→ Option A expose+derive). **Nothing structural pending Max.** WF2 by-engine research is GO (launched).

**WF2 (by-engine research) — now produces MORE than per-engine dossiers.** Per the review it must also yield:
1. an **input-boundary plumbing spec** (compute+surface D12, eccentricity, dropped primitives, expose the system graph);
2. the **type → derived-label demotion plan** (E1 outputs a label; nothing consumes a type);
3. the **epoch / host-editor evaluation model** (named epochs + editor-on-host composition).
Plus the original deliverables: per-engine mechanism · required inputs (flag L0 under-supply) · cheap procedural
approximations + citations · reference renders · engine↔feature map · cost estimate; the dependency **DAG**;
feasibility/budget triage → build order; map the 84-edge interaction audit
(`feature-interaction-audit-2026-06-20.md`) onto the engine model as a validation set; adversarially verify the
load-bearing/exotic/cheap-to-approximate claims. **Build WF2 to dodge the runner wedge** (plain-JS merges,
small-I/O judgment agents, per-agent disk-salvage; prefer direct background agents for fragile stages — see INDEX).

**Then:** first vertical slice — Max's recurring case: terrain↔sea-level↔drainage (does mountains+rivers collapse
into one engine?). Only after slice-pick is the design-direction doc written (the brainstorming terminal artifact).
