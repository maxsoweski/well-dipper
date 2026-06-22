# World-Engine History-Ordering Audit (Q3 — time's-arrow / story-lens review)

**Status:** DRAFT review, 2026-06-22. Answers Max's **Q3**: *does the current 5-tier
ordering of the 15 L1 engines reconstruct a coherent billions-of-years HISTORY when read
off the surface, and is anything OUT OF ORDER through that lens?*

Frame (from [`world-engine-architecture-spine.md`](world-engine-architecture-spine.md) §0):
what renders on a body is its **billions-of-years history + relationships with system
neighbors**; the engine dependency order **is time's arrow**; anything out of causal/temporal
order "reads" wrong. This audit grades the tier DAG against that standard.

Sources audited: spine §3 (15 engines / 5 tiers / I/O), the outcomes-catalog **Reclassification
notes** + **candidate-engine list**, `planet-drivers.js` (D1–D16, P1–P28 process→driver table),
`planet-feature-associations.js` (the actual declared `dependsOn.features` graph), and
`planet-visual-features.md` L1 **timescale signatures** + the **compositing rule**.

---

## TL;DR verdict

**Mostly coherent as a one-pass ordering, with three structural problems.** The 5-tier
spine gets the *gross* arrow right: define the body → force it → build relief → sculpt
relief → read the finished state. But three things break the "coherent history" standard:

1. **The composition-over-time gap is real and is the most important finding.** A flat
   "each engine runs once, in tier order" model **cannot represent the event SEQUENCES**
   the catalog itself documents (crater later intruded by magma; channel later exhumed
   into an inverted ridge; dune later frost-locked). This is not a tier-reordering issue —
   the tier DAG is the wrong shape for it. **Recommendation: host/editor composition +
   a small number of epochs.** (§3)
2. **At least two genuine feedback CYCLES** exist that a one-pass DAG cannot express
   (atmosphere↔surface via dust/frost; tidal-heat↔volcanism/figure). These need an
   evaluation order with a feedback field, or bounded iteration. (§2)
3. **A few engines are mis-tiered** through the history lens — most defensibly **E8
   space-weathering** (a late cumulative process currently bundled with early bombardment)
   and **E13 temporal overlay** (correctly last, confirm). Verdicts per engine in §4.

The current `planet-feature-associations.js` graph does **not** encode history order at all —
its `dependsOn.features` edges are **render-time masks** (frost reads `lakes`; deltas read
`rivers`; massWasting reads all relief), i.e. the L2 draw order, not the L1 causal order.
So today there is *no* artifact that encodes time's arrow; the spine's tiers are the first
attempt and this audit grades that attempt.

---

## 1. Time's-arrow check, tier by tier

Standard for each tier: *does its output plausibly come AFTER (in body history) everything
it consumes?* Tiers are evaluated as "what state of the body does this engine read, and is
that state already settled when the engine runs?"

| Tier | Engines | Reads | Verdict |
|---|---|---|---|
| **T1 Body-defining** | E1 composition, E2 figure/illumination | L0 only | **OK.** Composition class + bulk regime + figure are the body's *initial conditions* — they precede all process. Correctly first. Caveat: E2's *illumination* half is a render-frame, not history (see §4). |
| **T2 Forcing** | E3 tidal stress, E4 magnetosphere, E5 atmosphere | L0 + T1 | **OK with caveats.** Forcing fields are *boundary conditions* that persist across history, so emitting them before relief is defensible — relief consumers (E6, E11) need the stress tensor to exist. BUT E3 and E5 also *evolve* with what they shape (tidal-heat raises volcanism which changes the figure E2/E3 read; atmosphere thickness is set by escape which depends on field+age). These are the cycles in §2. |
| **T3 Relief** | E6 tectonic grain, E7 magmatism, E8 impact/space-weathering | L0 + T1 + T2 | **Split verdict.** E6/E7 (build relief) correctly precede T4 sculpting. **E8 is two engines welded together** — *bombardment* (early, builds craters, belongs in T3) and *space-weathering/regolith-maturity* (slow CUMULATIVE late albedo process that must run AFTER the surface it ages exists). Bundling them puts a terminal-age process in the relief-building tier. **Mis-tiered — split E8.** (§4) |
| **T4 Sculpting** | E9 hydrology, E10 aeolian, E11 cryosphere | T3 relief + T2 forcing + L0 | **OK ordering, but this is where SEQUENCE breaks.** Sculpting-after-relief is right. But these engines *re-edit* T3 outputs over multiple epochs (a river incises, base level drops, it incises again; a dune forms then gets frost-locked then re-mobilizes). One pass can't express the staged history the catalog documents. This is the composition-over-time problem (§3), localized here and at the T3/T4 boundary. |
| **T5 Modality** | E12 chemistry/province, E13 temporal, E14 inhabitation, E15 rings | reads everything below | **Mostly OK — this tier SHOULD run last and does.** E12 (body-wide palette/province) and E13 (seasonal/transient overlay) must read the *finished* surface, and they're correctly terminal. E14 inhabitation composites over a finished base world (matches the `planet-visual-features.md` compositing rule). E15 rings is system-level and time-invariant — fine last. The one wrinkle: E12 *province* is arguably a body-defining input, not a terminal readout (see §4). |

**Net:** the gross arrow is correct. The failures are (a) E8 mixing an early and a late
process in one tier, and (b) T4/T5 needing to read states that are only finished *after
later epochs of the same engines* — which a single forward pass cannot provide.

---

## 2. Cycles / mutual dependence (a one-pass tier DAG cannot express these)

A pure tier DAG requires every edge to point "downhill" in tier order. Each pair below has
edges in **both** directions, so no acyclic tier assignment is faithful. Flag + resolution:

**C1 — Atmosphere ↔ surface (dust/frost/volatile budget).**
- Atmosphere (E5/T2) sets wind, frost deposition, dust opacity → drives aeolian (E10/T4)
  and cryosphere frost (E11/T4).
- BUT the surface sets the *dust supply* and *frost reservoir* that the atmosphere carries:
  the catalog's **"single dust-budget driver → haze + mantle + streak sign"** note makes
  haze (atmosphere) and surface dust mantle one shared state variable; the **"frost engine
  gates aeolian activity (CO2 armoring locks dunes)"** note makes the frost cycle both an
  atmospheric output and a gate on a surface engine.
- *Resolution:* a **shared dust-budget / frost field** evaluated once and read by both the
  atmosphere and surface engines (the catalog already proposes the dust-budget state engine).
  Fixed evaluation order with a feedback field — not iteration — suffices because the budget
  is a slowly-varying reservoir, not a fast loop.

**C2 — Tidal heat ↔ volcanism ↔ figure.**
- E3 (tidal stress/heat, T2) drives E7 magmatism (T3) and figure deformation.
- BUT volcanic resurfacing and figure change alter the body's response to tidal forcing
  (Io's heat-pipe state, despinning changes the stress tensor E6 reads). D12 tidalHeating
  feeds P2/P4/P6/P7 *and* is itself a function of the orbital+interior state those processes
  modify.
- *Resolution:* treat tidal-heat as a **quasi-static forcing field** (place once at the
  body's representative epoch — the lean the spine already adopts: "don't time-step billions
  of years"). Accept the steady-state approximation; document it as a deliberate physical
  simplification, not a bug. If a body needs both an early and a late tidal regime, that's an
  **epoch** boundary (§3), not iteration.

**C3 — Base-level ↔ fluvial/coastal (the project North-Star case).**
- Hydrology (E9) needs a base level (sea/lake surface) to route to; the standing-liquid body's
  fill level *is* set by the same hydrology solver. The catalog's **"single water-routing
  engine — five stages sharing one base-level variable"** note names this directly.
- *Resolution:* this is an **intra-engine** fixed-point, not a cross-tier cycle — solve it
  inside E9 with one shared base-level variable (the catalog's prescription). Not a tier
  problem; flagged so it isn't mistaken for one.

**C4 — Figure/illumination ↔ everything (weak).**
- E2 figure is T1 (initial), but despinning/TPW and volcanic loading change the figure that
  later engines' orientation fields (E6 grain) read. The catalog's despinning + true-polar-
  wander engines **overprint** an already-cracked surface with an angularly-offset second
  generation of lineaments.
- *Resolution:* epochs (§3) — a "second-generation grain" pass that reads the first-generation
  surface, rather than folding both into one E6 evaluation.

**Bottom line on cycles:** C1 and C4 need architectural support (shared field / epoch). C2 and
C3 are resolvable by the spine's existing "place once at a representative epoch" lean (C2) or
intra-engine fixed-point (C3). None is fatal, but **C1 and C4 cannot be expressed in the
current flat tier DAG** and must be designed in.

---

## 3. Composition-over-time (THE central finding)

**Claim:** the catalog repeatedly documents outcomes that are a **SEQUENCE of events on the
same patch of ground**, and a "each engine runs exactly once, in tier order" model
**structurally cannot represent them.** The catalog's own Reclassification notes say this in
as many words — these are the load-bearing quotes:

- *"Model floor-fractured / irregular-mare craters as a volcanism-overlay-on-impact composite
  (composable engines)"* — "an impact crater later intruded by magma… arguing for **engines
  that compose over each other's outputs rather than a flat feature list.**"
- *"Treat a crater as a persistent HOST edited over time by later engines (composition over
  emission)"* — "An impact crater is often a vessel later modified by a second engine… the
  crater is a persistent host whose appearance is **edited** by volcanism, sublimation or
  aeolian engines… **features compose over time rather than being independently emitted.**"
- *"Drainage engine with a relief-inversion stage — inverted channels are the same engine,
  flipped sign"* — a channel (low) is later indurated + exhumed into a ridge (high). Same
  patch, two epochs (deposition, then differential erosion).
- *"Drive ray BRIGHTNESS by the space-weathering engine"* + *"Treat a crater as a persistent
  HOST…"* — ray brightness = impact geometry (early) THEN space-weathering age (late). Two
  engines, ordered in time, on one feature.
- *"Frost engine gates aeolian activity (CO2 armoring locks dunes)"* — a dune forms (aeolian)
  THEN is frost-locked (cryosphere) THEN re-mobilizes seasonally. A *temporal* state machine,
  not a one-shot.
- *"Split F18 into a solid-state convection CANVAS engine and a sublimation PAINT engine"* —
  "One is the canvas, the other is **paint applied to it**" — explicitly composition (paint
  over canvas), explicitly ordered.

**Why the flat tier model fails it.** Tiers express *which engine reads which engine's
output*, once. They cannot express *the same engine running again at a later epoch* (river
incises → base-level drop → incises again) or *one engine editing a host that a much-earlier
engine emitted* when intervening tiers have run in between. The catalog's L1 timescale
signatures (`planet-visual-features.md`) confirm the problem is temporal, not topological:
P1 impacts "accumulate over D16," P4 volcanism "resets local surface age," P8 fluvial leaves
"active=sharp / relict=degraded," P22 frost is "seasonal (annual cycle)." These run on
*different clocks*; a single ordered pass collapses all clocks into one tick.

**Recommendation (two mechanisms, both cheap):**

1. **Host/editor composition (spatial).** Promote the catalog's "persistent host edited by
   later engines" pattern to a first-class architectural primitive: an engine may declare a
   **host field** (e.g. the crater low / cap) that a *later* engine **edits in place** rather
   than emitting a fresh independent feature. This makes floor-fractured craters, pedestal
   craters, relief-inversion ridges, and canvas+paint expressible. This is the minimum change
   and it matches the existing `dependsOn.features` machinery — but those edges must be
   re-typed from "render mask" to "history edit."
2. **A small fixed set of EPOCHS (temporal).** NOT time-stepping billions of years (the spine
   forbids that). Instead 2–4 named epochs the whole stack runs against — e.g. *primordial*
   (heavy bombardment + magma ocean), *active* (tectonics/volcanism/hydrology), *quiescent*
   (space-weathering, frost cycling, transient overlay). An engine declares which epochs it
   fires in; later epochs read earlier-epoch fields. This expresses "early grain + despun
   second-generation grain," "fresh ray then weathered ray," "channel then exhumed ridge,"
   and the C2/C4 cycles' early-vs-late regimes — *with a bounded, cheap pass count.*

**This is the one finding that changes the architecture's shape, not just its tier labels.**
The 15 engines / 5 tiers are a sound *catalog of mechanisms*; they are not yet a *history
machine* until host/editor composition and epochs are added.

---

## 4. Per-engine tier verdict (history lens)

Verdicts on the spine §6 candidate re-slots plus others this audit surfaces:

| Engine | Current tier | Verdict | Reason (history lens) |
|---|---|---|---|
| **E1 Composition & regime** | T1 body-defining | **Keep T1.** | Initial conditions; precedes all process. |
| **E2 Figure & illumination** | T1 body-defining | **SPLIT.** Figure → keep T1. Illumination → **render-frame sidecar, not a history tier.** | Figure is an initial condition (and an epoch-evolving one, C4). Illumination (terminator/eyeball/pulsar) is *how the finished body is lit at view time* — it has no place in time's arrow. Spine §6's "base-vs-render-frame-sidecar" instinct is correct: pull illumination out of the history DAG entirely. |
| **E3 Tidal / orbital coupling** | T2 forcing | **Keep T2 (forcing), with the cycle caveat.** | Correctly precedes its consumers — E11 cryosphere lineaments explicitly read E3's stress tensor, and E6 grain reads despin stress. The spine §6 "forcing-vs-relief" question resolves to **forcing**: the stress *field* is a boundary condition relief reads, even though tidal *heat* participates in cycle C2. Don't demote to relief. |
| **E4 Magnetosphere / radiation** | T2 forcing | **Keep T2.** | A persistent field mask; space-weathering (the late E8 half) and aurora read it. Boundary condition, correctly early. |
| **E5 Atmosphere / climate** | T2 forcing | **Keep T2 for terrestrials (forcing); flag it is ALSO terminal-surface for gas giants.** | Spine §6's "forcing-vs-terminal-surface" tension is real but is a *per-body* split, not a tiering error: on a gas giant the atmosphere IS the surface (terminal, reads nothing below); on a terrestrial it's forcing for E9/E10/E11. Resolve by letting E5 emit into *either* role by regime, not by moving its tier. Also participates in cycle C1. |
| **E6 Lithospheric grain** | T3 relief | **Keep T3.** | Builds relief from T2 forcing; correctly before sculpting. Needs the structured *orientation field* the L0-gap (spine §4) flags. |
| **E7 Endogenic-heat / magmatism** | T3 relief | **Keep T3** as a *builder*, but it is also a *late editor* (host/editor §3). | Builds edifices/plains (T3). BUT it also intrudes pre-existing craters (floor-fractured) — that role is a later epoch editing an E8 host, not a T3 emission. Same engine, two epochs. |
| **E8 Impact / bombardment & space-weathering** | T3 relief | **SPLIT — the clearest mis-tier.** Bombardment → T3. Space-weathering/regolith-maturity → **a late terminal-modality process (T5-adjacent), running AFTER the surface it ages.** | Bundling a one-shot early excavation engine with a slow cumulative late albedo engine forces a late process to evaluate in the relief-building tier. The catalog's "drive ray brightness by the space-weathering engine" and "crater as persistent host" notes both require weathering to run *after* impacts AND after later resurfacing. Split per the catalog's own candidate list (impact-cratering engine vs space-weathering engine are listed separately). |
| **E9 Hydrology** | T4 sculpting | **Keep T4.** | Sculpts T3 relief; correctly after relief. Houses the base-level fixed-point C3 internally. |
| **E10 Aeolian** | T4 sculpting | **Keep T4**, gated by frost (C1) and re-run across epochs (§3). | After relief; shares dust/frost state with E5/E11. |
| **E11 Cryosphere** | T4 sculpting | **Keep T4.** | Reads E3 stress tensor (forcing, T2) — dependency correctly satisfied — and sculpts relief. Cryotectonic resurfacing is a late editor (epochs). |
| **E12 Surface-chemistry & province** | T5 modality | **SPLIT.** Surface-chemistry/palette → keep **T5 terminal** (reads finished surface). Compositional-PROVINCE → move toward **T1 body-defining.** | Spine §6's "modality-vs-body-defining" tension resolves by splitting: the *palette/hue* field is a terminal readout of the finished surface (correctly last), but a *whole-disk province* (Titan bright-continent vs dark-sand-sea, Io equatorial-vs-polar zonation) is a body-organizing layer that *should bias where earlier engines act* — so the province field is an early organizing input, not a terminal overlay. `planet-feature-associations.js` already hints at this: features carry a `provinceGroup` that gates *where* they render, which is body-defining, not terminal. |
| **E13 Temporal / transient** | T5 modality | **Keep T5 — correctly LAST.** | Seasonal/transient overlay (RSL, frost flush, dust-clearing, spokes) reads the finished history and varies on top of it. This is the one engine that *must* be terminal, and it is. Confirmed correct. |
| **E14 Inhabitation** | T5 modality | **Keep T5.** | Composites over a finished base world per the `planet-visual-features.md` compositing rule ("base-type + overlay; base world's oceans/weather/relief still show through"). Correctly terminal. |
| **E15 Ring / circumplanetary** | T5 modality | **Keep T5.** | System-level, time-invariant; reads the finished disk to cast ring-shadow/spokes. Fine last. Needs the system-graph the L0-gap (spine §4) flags. |

**Mis-tier summary:** **E8 split (bombardment T3 / weathering late)** is the highest-confidence
fix. **E2 illumination → render-frame sidecar** and **E12 province → body-defining** are the
two split-verdicts that also matter. E3/E5 stay put (their §6 tensions are per-body role
splits, not tier errors). Everything else is correctly tiered.

---

## 5. Recommendations (priority order)

1. **Add host/editor composition + epochs (§3).** Highest leverage — without it the stack is
   a mechanism catalog, not a history machine. Re-type `dependsOn.features` edges from
   render-masks to history-edits where they encode "X edits Y's host."
2. **Split E8** into bombardment (T3) and space-weathering (late/terminal).
3. **Pull E2 illumination out of the history DAG** into a render-frame sidecar; split **E12
   province → body-defining, palette → terminal.**
4. **Design the two cross-tier cycles** C1 (dust/frost shared field) and C4 (despin/TPW
   second-generation grain via epochs). C2/C3 are handled by the existing "place once at a
   representative epoch" lean + intra-engine fixed-point.
5. **Note that the current `planet-feature-associations.js` graph encodes RENDER order, not
   HISTORY order.** A separate history-edge artifact (or a re-typing of the existing edges) is
   needed before the spine's tiers can be said to encode time's arrow.

---

*Audit basis: spine §3/§4/§6; outcomes-catalog Reclassification notes + candidate-engine list;
`planet-drivers.js` D1–D16 / P1–P28; `planet-feature-associations.js` dependency graph;
`planet-visual-features.md` L1 timescale signatures + compositing rule. Uncertainty noted
inline; the composition-over-time and E8-split findings are high-confidence (the catalog states
them outright); the C1/C4 cycle resolutions are design proposals, not yet validated against WF2.*
