# Multi-star render feasibility — investigation report

**Trigger:** Max's directive 2026-07-19, issued while reviewing `system-identity-grammar`
(VERIFIED_PENDING_MAX `5583651`), verbatim:

> "CAN we implement a system by which a stellar relationship like with this 3-body one can be
> rendered at the SYSTEM nav view scale and the actual system in-game environment scale? Can
> we make that feasible? And if it's TRULY infeasible to render systems like this in the
> in-game system environment, (but we'll check many different opportunities to make it
> feasible first), how can we get the nav view relationship between the PRISM and SYSTEM
> views to represent this better? Because currently there simply is no way to select the
> proxima centauri part of the system that includes the planets orbiting that star, clicking
> on any of the three stars in the PRISM view sends us to the inner part of the system that
> only currently renders rigil and toliman"

**Ground truth gathered by:** 3 parallel read-only explorations (spawn path + scale;
lane-B supercruise/DEPART surface at `well-dipper-supercruise`; data-model blast radius) +
a bit-exact float32 probe (`Math.fround`) + prior-art review
(`~/briefings/well-dipper-binary-separation-analysis.md`, 2026-06-04). Line of sight:
exploration-immersion — a triple like Alpha Centauri should be *experienceable* as a
triple (visit Proxima, see her planets), not just labeled as one.

**Headline answer: YES — the in-game half is feasible.** The blocker everyone assumed
(float32 precision at 13,000 AU) is already solved in this codebase: `src/core/WorldOrigin.js`
implements floating-origin rebasing (threshold 100 su, logical coordinates in JS doubles),
and `RetroRenderer` uses a logarithmic depth buffer. The real constraints are architectural
(two-star lighting cap, single-barycenter scene, `camera.far`), and the component-pocket
avenue (§3.2) sidesteps every one of them by reusing machinery that already exists.

---

## 1. Problem statement

Alpha Centauri is authored as A+B at 23.5 AU (`star`+`star2`, spawned and orbiting) plus
Proxima at 13,000 AU in `systemData.farCompanions` — a data record
`{name, class, type, separationAU, planets?}` with **no orbital elements, no seed, no scene
body**. `grep farCompanion src/main.js` returns zero hits: far companions are never spawned
in-world; they exist only as nav-canvas chips (`farCompanionChips.js`) and prism membership
labels. The chip is draw-only — no click handler, no drill. So there is no way, in-game or
in-nav, to *select the Proxima part of the system* and see planets b and d as anything but
letters on a chip. Clicking any of the three stars in PRISM lands (correctly, per identity
unification) on the ONE authored system — whose SYSTEM view and in-game spawn render only
the A+B inner pair.

The scale ratio is the crux: pair 23.5 AU vs Proxima 13,000 AU (~550×). No single rendered
frame holds both as bodies; no current mechanism carries the player across the gulf.

## 2. Ground truth — scale, precision, existing machinery

### 2.1 Scale facts (verified at `62fe938`)

| Fact | Value | Anchor |
|---|---|---|
| Scene scale | `AU_TO_SCENE = 1000`; 1 su ≈ 149,598 km = 0.001 AU | `src/core/ScaleConstants.js:39` |
| World proportions | Real-scale: radius on the SAME 1000 su/AU map as distance (G star = 4.65 su, Earth = 0.0426 su). No orrery compression in the 3D world; the compressed scale (`mapUnitsPerAU`, `MAP_SCALE`) is 2D-HUD-only | `ScaleConstants.js:28-38`, `solarRadiiToScene`, `SystemMap.js` |
| α Cen pair today | star2 spawns at `binarySeparationScene` = 23,500 su, mutual barycentric orbit | `main.js:4393-4407, 7600-7618` |
| Proxima true distance | 13,000 AU = **13,000,000 su** | authored `stellarCompanions.js:87-104` |
| Farthest current spawn | outer planets ≤ ~50,000 su (`maxOrbitAU = 50·√L`) | `StarSystemGenerator.js:447` |
| Main-camera far plane | `far = 200,000` su (65× short of Proxima; dynamically raised for navigable nebulae — precedent exists) | `main.js:131, 4251-4255` |

### 2.2 Precision probe (bit-exact `Math.fround`; scratchpad `float32-probe.mjs`)

| Distance from origin | float32 position quantum |
|---|---|
| 2 su (ship neighborhood) | 36 m |
| 23,500 su (star2 today) | 292 km |
| 1,000,000 su (1,000 AU) | 9,350 km |
| **13,000,000 su (Proxima)** | **1 su ≈ 149,600 km** |

- **float64 (JS numbers) never blocks:** quantum at 13M su is 0.28 m. All logical positions
  are JS doubles.
- **float32 world-space storage/stepping at 13M su is catastrophic:** placement error up to
  ~75,000 km; per-frame world-space motion below ~75,000 km/frame freezes entirely.
- **But the engine never does that near the camera:** `WorldOrigin.maybeRebase` re-centers
  the scene whenever the camera drifts >100 su (`REBASE_THRESHOLD_SQ = 100²`), so the GPU
  only ever sees small rebased deltas; `logarithmicDepthBuffer: true` + `near = 1e-9`
  handle depth. Spawn-once objects use `placeInRebasedFrame`; rebase survival is tested
  (`tests/warp-tunnel-rebase.test.js`, `orbit-ring-rebase.test.js`).

**Consequence:** the 94-day-old assumption that "rebasing is deferred, precision blocks far
travel" is stale. Precision does not veto ANY avenue below. (The 2026-06-04 wide-binary
analysis reached the same conclusion for *rendering*; the floating origin now extends it to
*travel*.)

### 2.3 Machinery that already exists (the reuse inventory)

- **Floating origin** — `WorldOrigin.js` (above). `spawnSystem` calls `_resetWorldOrigin()`
  at every swap (`main.js:4247`).
- **Scene-recenter primitive** — `warpSwapSystem` (`main.js:6261`): camera teleport +
  `_resetWorldOrigin()` + `cameraInterp.resync(camera)` under the occluded HYPER pocket
  (`WarpEffect` FOLD→ENTER→HYPER→EXIT; `portalTraversal.js` plane-crossing state machine,
  load-adaptive destination-ready gate). Hard-wired today to "new system, new seed"
  (`onPrepareSystem` increments `seedCounter`) — but the primitive IS "re-center the world
  on point X while the player is inside a tunnel."
- **Sky machinery** — separate camera-locked sky pass (`SkyRenderer`, `StarfieldLayer`,
  `SkyFeatureLayer` at ~500 su dome radius, NOT bounded by main far plane), direction-true
  star placement, ray→star picking (`findNearestStar`), warp-target reticle
  (`setTargetMarker`). Sky stars are already click-to-warp targets.
- **Supercruise** — `SupercruiseModel` capped at `CAP_MAX = 20,000` u/s (byte-frozen
  `SC_TUNING`); cap scales with distance-to-nearest-body-surface, NOT distance-to-target.
  A 13M-su leg ≈ **11–15 min** real time. WS-1 stall detector is cap-relative (tolerates
  long legs). Star arrival standoff (`tourStandoff.starParkRadius` ~8R) generalizes to any
  star.
- **DEPART (lane B, already `building`)** — `autopilot-depart-2026-07-15`: radial-climb
  escape from the current body, all-bodies horizon predicate (explicitly closes the
  "star2 has no star-level keep-out" gap), ETA-scheduled physics deceleration replacing the
  HOLD position-lerp. Exactly the departure/arrival behavior a companion trip needs.
  **Board note:** lane B has moved past its last coordinator relay — orrery-coherence is
  VERIFIED_PENDING_MAX `802cceb` and DEPART is greenlit/`building`, not pending-scoping.
- **Multi-star-per-scene precedent** — `_deepSkyStars`/`system.extraStars`
  (`main.js:4862-4899, 5515-5579`): open clusters / navigable nebulae already spawn many
  `StarFlare`s in one scene — but scaled-down, ungravitated, decorative.
- **Components data recipe** — `farCompanions` proves the byte-identity-safe pattern:
  authored-only, omitted entirely from procgen output, zero RNG draws
  (`StarSystemGenerator.js:856-867`; ProcgenSnapshot pins only purely-procgen samples).

## 3. In-game avenues (checked FIRST, per the directive)

### 3.1 True-distance shared scene — spawn Proxima + b/d at 13M su in the SAME scene

**What breaks:** (a) two-star lighting cap — shaders receive exactly `starPos1`/`starPos2`
(`main.js:7700-7715`); Proxima's planets would have no light source, and no third slot
exists; (b) `camera.far = 200,000` — the companion is invisible in the main pass without a
65× extension (log depth makes this *survivable*, but the sky pass already does this job
correctly); (c) single-barycenter assumptions — `GravityField`, tour queue
(`AutoNavigator.buildQueue` treats star2 as an ordinary nearby stop), gravity-well HUD,
`SystemMap`, ORRERY framing (drops >5× orbit gaps, `main.js:6415`); (d) travel time — 11–15
min under the byte-frozen cap, unshortenable without touching `SC_TUNING`.

**What it costs:** engine surgery across lighting, gravity, HUD, autopilot — the widest
blast radius of any avenue — for an experience (a many-minute cruise through empty space)
that is itself a design question.

**What it unlocks:** seamless one-world purism; manual flight between components with no
transition.

**Verdict: feasible (precision does NOT veto it — the floating origin genuinely supports
the journey) but WRONG as the primary path.** The lighting/sim surgery buys nothing the
pocket avenue doesn't deliver cheaper. Keep as a possible future flourish (a purist
"fly there for real" mode) once dual-neighborhood lighting exists for other reasons.

### 3.2 Travel-linked component pocket (fold/mini-warp) — ⭐ RECOMMENDED

Each component of a wide multiple is its own spawned neighborhood (its own `spawnSystem`
payload, own barycenter at origin, own lighting/gravity/HUD — every current assumption
preserved *per scene*). Travel between components reuses the warp-swap recenter primitive
with a shorter, intra-system dressing: target the companion (from the sky marker, nav, or
a tour stop) → DEPART-style escape leg → occluded pocket transition → `spawnSystem` of the
component's neighborhood → arrive at star standoff. Identity-wise it is ONE system
(§6 grammar law): same system name, same canonical seed family, component annotated —
"arrival lands in the system; the component is a *location within it*," which preserves
the "one destination" invariant rather than renegotiating it (the nav destination is still
Alpha Centauri; which component you stand in is intra-system position, like being near a
planet).

**What breaks:** nothing structural — this is the avenue's core virtue. New work, not
breakage: (a) a "swap to component" path that bypasses the galactic destination resolver
and new-seed generation (today `warpSwapSystem` is hard-wired to fresh systems); (b) the
components data substrate (§3.3); (c) an affordance that respects mode ownership (ORRERY
never flies; autopilot legal iff hands-off; the nav-autopilot gate lands in lane B's
orrery-coherence).

**What it costs:** medium. Data substrate (lane C, zero main.js) + one new transition path
(lane B territory: main.js warp/flight sections) + nav/sky affordances. Dependency: the
parked `warp-tunnel-pocket-traversal` rig (status `building`, arrival-polish tasks 4–7
unfinished) is the transition's dressing — reusable now for the mechanism, finishable in
its own workstream.

**What it unlocks:** the full directive — visit Proxima, see b and d as real generated
bodies. Generalizes to every authored wide multiple (36 Oph's tertiary at 4,400 AU) AND to
the confirmed-intent wide-binary procgen feature (2026-06-04: "binaries of all kinds should
occur naturally, some close, most farther out") — components ARE the missing S-type
architecture: planets orbit one star; the far companion is a separate neighborhood.

### 3.3 Hierarchical systemData — the data substrate (required by 3.2 and by the nav drill-in)

Promote far companions from inert records to spawnable component sub-systems.
**Terminology trap:** `companionSpec.components` already exists (≤2 close-pair spectral
descriptors, `stellarCompanions.js:21-24`); the new field needs a distinct name —
`systemData.componentSystems` (working name).

- **Byte-identity: SAFE** by the proven `farCompanions` recipe — authored-only, key omitted
  from procgen output, zero RNG draws on the procgen path. ProcgenSnapshot (24/24) pins
  only procgen samples and re-filters real-covered cells.
- **Seed derivation: asymmetric.** Proxima's own catalog position falls outside the 0.1 pc
  F1 quantization bin → she derives her own deterministic `realStarSeed` for free. Close
  members (A+B) deliberately collapse to ONE F1 seed — if close components ever needed
  separate neighborhoods (they don't, for v1: the A+B pair IS one neighborhood), that would
  need a reviewed component-index salt. **v1 needs no new seed policy.**
- **Oracle lockstep:** `multiplicityOracle.count` and the test helper `mult()` are defined
  as `1 + (star2?1:0) + farCompanions.length`. If components replace/extend farCompanions,
  both must change in lockstep or glyph honesty (AC7) breaks.
- **Arrival core:** `resolveArrivalSystem` flows a new authored field through transparently
  (it never reads structural star fields); the authoring happens in
  `KnownSystemAuthoring.buildAuthoredContext` / `RealSystemOverlay.resolve`.
- **Planet generation:** Proxima b/d are archive-shaped letters today. The component's
  payload generates them as real bodies (KNOWN_SYSTEM_CONTENTS pins, procgen fill per the
  fill-ON ruling) — the same authoring machinery α Cen's pair already uses.

**Rep-cap amendment — narrower than feared.** The 2-close-star cap (§1) was written about
*the scene*: "scene-rendered, gravitationally-modelled stellar content is capped at
star + star2." Components don't add a third star to any scene — each component scene still
holds ≤2 close stars. What changes is §2's "Data-level v1: no scene body" sentence —
far companions gain *their own scene*, not a slot in the pair's scene. §3 (higher-order
collapse) also survives per-component. The amendment is a targeted supersession of §2's
v1 line, not a repeal of the cap.

### 3.4 Sky honesty + affordance — cheapest read, ships in any ordering

Proxima painted as a correctly-positioned bright point in the A+B sky (the `StarfieldLayer`
already places real catalog stars by true direction; per rep-cap §2 the dim-host supplement
was expected to carry her — **verify live whether she's actually present and how bright**;
from α Cen she should be a naked-eye star, apparent mag ~4–5). Reciprocally, from Proxima's
pocket, the A+B pair should blaze in HER sky (mag ≈ −6.5/−5.2 — far brighter than Venus).
The existing `setTargetMarker`/`findNearestStar` machinery makes her targetable; the
affordance ("travel to companion") triggers §3.2. Without §3.2, sky honesty alone is still
worth having — it makes the triple *visible* as a triple from in-game.

### 3.5 Scenery StarFlare (enumerated, not recommended)

The `_deepSkyStars` pattern could spawn Proxima as a scaled-down decorative `StarFlare` in
the A+B scene. Rejected as primary: not-to-scale (violates the world's real-proportion
doctrine), ungravitated, non-visitable — and the sky pass (§3.4) does the same perceptual
job honestly.

### 3.6 Compressed in-world placement (enumerated, not recommended)

Spawning Proxima at a representational distance (say 100,000 su instead of 13M) borrows
Max's "map is intentionally exaggerated" principle — but that principle was stated about
the 2D map; the 3D world is deliberately real-scale (`ScaleConstants.js` header doctrine).
Compression would put a body where the sky says nothing is, break reciprocal sky honesty,
and make the authored 13,000 AU a lie in-world. Named for completeness; the tension with
the scale doctrine is disqualifying unless Max re-rules the doctrine itself.

## 4. Nav-side design (the near-term bridge — wanted regardless of §3's outcome)

The complaint is concrete: *no way to select the Proxima part with her planets.* Four
coordinated pieces, all §6-grammar-compliant (clause 3 explicitly anticipates
member-specific entry: "the view says so explicitly"):

1. **Component drill-in sub-view** — copy the planet-detail drill pattern exactly:
   `_systemMode = 'component'` + `_selectedComponentIdx` (mirrors `'planet'` +
   `_selectedPlanetIdx`, `NavComputer.js:3783-3789`), rendered by a
   `_renderComponentDetail` (mirrors `_renderPlanetDetail:2559`), ESC pops back. Entered
   from (a) a new far-chip click handler (`_farChipRects` is already published, hover-only
   today) and (b) Proxima's own PRISM marker (drill lands in the α Cen SYSTEM view with the
   Proxima component pre-selected — clause-3 annotation "via Proxima Centauri — far
   companion"). Breadcrumb: "part of Alpha Centauri."
2. **Honest content rule:** the sub-view renders REAL component data — which is why it
   rides the §3.3 substrate. Until components land, a drill-in could only show archive
   letters/classes/separation (no fabricated orbits — fabricating them would recreate the
   preview≠arrival defect class the unification workstream just closed). This is the
   reason the grammar workstream parked the drill-in rather than building it.
3. **SYSTEM-view component presence** — the far chip stays; optionally an edge-star glyph
   with dashed partial-orbit arc + separation tag gives the companion visual presence in
   the orrery frame (design option already on record). Secondary to the drill-in.
4. **Warp semantics unchanged:** one destination per system (§6 invariant). The drill-in
   is a VIEW. If §3.2 ships, the component view gains a "travel to this component" action
   that fires the in-game transition — an intra-system move, not a second warp destination.

## 5. Blast radius & cross-lane

- **Lane C owns:** §3.3 substrate (StarSystemGenerator, stellarCompanions authoring,
  KnownSystemAuthoring, RealSystemOverlay, oracle+mult lockstep, snapshot-safety), §4 nav
  work (NavComputer sub-mode + pure helpers), rep-cap §2 amendment text. Zero main.js —
  lane C's boundary holds.
- **Lane B owns / joint scoping:** the §3.2 transition path (warpSwapSystem-adjacent
  main.js, mode-ownership invariants, DEPART machinery, nav-autopilot gate). The handoff
  anticipated this overlap; the grounding confirms it and strengthens it — DEPART is
  ALREADY `building` and its all-bodies horizon predicate + ETA-decel are the companion
  trip's departure/arrival halves. **Recommendation: the §3.2 increment scopes in a JOINT
  lane B+C interview**, sequenced after orrery-coherence's UAT.
- **Pocket-traversal dependency:** the transition's tunnel dressing reuses the parked
  `warp-tunnel-pocket-traversal` rig (tasks 4–7 unfinished). The component fold can ship
  on the rig as-is (the warp already uses it); finishing its polish tasks stays that
  workstream's own business.
- **ORRERY framing:** the >5× orbit-gap heuristic (`_frameSystemForOrrery`) correctly
  keeps far components out of the pair's frame; each component's own scene frames itself.
  No change needed under §3.2 (a shared-scene avenue would have had to fight it).
- **Open UAT gates:** AC9 re-run (overlay), AC11 (unification), AC8 (grammar) all ride
  this ruling — the census/PRISM/SYSTEM behaviors they gate are unchanged by §3.3/§4
  data+view work, so they can re-run on the first increment's build.

## 6. Recommendation & sequencing

**Rec: composite of §3.3 + §4 (lane C, first increment) then §3.2 (joint B+C, second
increment), with §3.4 sky honesty folded into whichever increment touches it first.
§3.1 true-distance and §3.5/§3.6 are enumerated and set aside.**

1. **Increment A (lane C, scope after ruling):** `componentSystems` substrate + component
   drill-in view + rep-cap §2 amendment + oracle lockstep. Delivers Max's concrete
   complaint (select the Proxima part, see b/d with real orbits in nav) without touching
   main.js or lane B territory. All three open UAT gates re-run on this build.
2. **Increment B (joint lane B+C scoping):** the component travel transition (fold path
   reusing warp-swap primitives + DEPART legs + mode-ownership-compliant affordance + sky
   target marker). Sequenced with lane B's queue (orrery-coherence UAT → DEPART → this).
3. **Later, unlocked:** wide-binary procgen (S-type via components — the confirmed
   2026-06-04 intent), optional purist in-scene cruise, pocket-traversal polish.

**Decision points for Max (the ruling):**

- **D1 — Amend rep-cap §2** (far companions gain spawnable component scenes; the
  2-close-star per-scene cap itself is preserved)? This is the gate for everything else.
- **D2 — Arrival semantics framing:** ratify "component = location within the one system"
  (preserves §6's one-destination invariant; nav warp still lands at the system's primary
  component; component travel is an in-game intra-system move). The alternative — separate
  warp destinations per component — renegotiates §6 and is NOT recommended.
- **D3 — Transition experience** (Increment B taste call, can defer to its scoping): fold
  through a short pocket (seconds, warp-flavored) vs real supercruise leg (11–15 min) vs
  fold-with-optional-manual-cruise. Grounding says the fold is the buildable default; the
  cruise is *possible* (precision-clean) but long.
- **D4 — v1 breadth:** α Cen only, or all authored wide multiples at once (36 Oph tertiary
  at 4,400 AU rides the same substrate for free)?

## 7. Verification anchors (for the increments' contracts)

- **Live:** Proxima present/bright in α Cen's in-game sky (and A+B blazing in Proxima's,
  once her pocket exists); far-chip click → component sub-view with b/d; PRISM Proxima
  marker → annotated component view; warp destination unchanged (seed 1816942132 both
  markers); component transition round-trip (A+B → Proxima → A+B) with mode-ownership
  invariants held (drive rules: stop `window._autoNav`, CDP press_key only).
- **Suite:** ProcgenSnapshot 24/24 byte-identical (components key absent from procgen);
  oracle/mult lockstep tests; baseline 1,557 + new units. Vitest from repo dir only.
- **Census:** `componentSystems` authored for every `STELLAR_COMPANIONS` entry with
  farCompanions; validator extended.
- **Cross-lane:** joint-scoping artifact for Increment B; lane B board rows refreshed
  (orrery-coherence VERIFIED_PENDING_MAX `802cceb`; DEPART `building`).

## 8. Standing items carried (do not lose)

1. AC9 re-run / AC11 / AC8 UAT verdicts all OPEN — ride this ruling (§5).
2. Branch push/merge Max-gated (~34 ahead of origin).
3. α Cen A/B zero-fill = SHIP-AS-IS standing; empty-rate calibration parked.
4. Six absent famous stars, structures authoring, seedtags (AC2 search = designated home) —
   parked.
5. Verifier nits: FIX-2 fixture comment; multiplicityOracle degenerate ternary
   (`:157-158`, metadata-only); U3 hover+selection cosmetic double-draw.
6. Scoped doc-rot tooling gap for directory-format workstreams (lane A fixed 2026-07-14;
   port-check owed on this branch).
7. Lane B flags unchanged: boot-tour warp collision; mid-flight warp dispatch ungated;
   onTourComplete re-arm question.
8. NEW (this session): lane B board drift — orrery-coherence + DEPART moved past last
   relay; coordinator lane table needs refresh at next relay.
