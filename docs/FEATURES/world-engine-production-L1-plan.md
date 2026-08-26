# World-Engine Production-L1 Port — Workstream Plan (features + done-criteria)

**Date:** 2026-06-23. **Repo:** `~/projects/well-dipper`, branch `master` (planning doc only — additive). ⛔⛔ **STATUS CORRECTED 2026-08-20 (B0 item 8). THIS HEADER READ "Status: PLANNING… not built" FOR EIGHT WEEKS WHILE FOUR DOCUMENTS CITED THIS FILE AS THE OWNER OF LIVE WORK.** Every claim below was re-verified in `git log` this run, not carried from a document: **WS1 SHIPPED 2026-06-24** — F1 real tidal heating (`367f9fd`), F2 orbital eccentricity (`27a77f5`), contract marked verified (`ec0cea5`). **WS2 SHIPPED 2026-06-25, Max UAT-passed 16/16** (`4b358dc`). **WS4 BUILT AND FAILED UAT 2026-06-25** — generative-architecture pivot, explicitly NOT shipped (`3bd231c`); its successor line, `world-engine-baked-relief-render-2026-06-25` increment 1, passed Max's UAT 2026-08-20 (`cda0b5b`), but ⛔ **WS4 SHIPPING IS STILL NOT IMPLIED.** **WS3 NOT STARTED.** ⭐ Its standing hold (`docs/NOW.md:1160`, *"do NOT ship WS4; do NOT start WS3"*) was **LIFTED by Max on 2026-08-20** (`5b1099b`) as SATISFIED, not retracted. ⚠ WS3 F2's ownership of the `featureRelevant` / `rendersOn` migration is contested against `one-pipeline-two-frontends-PLAN.md`, which fences it out — open as **D-7** in `docs/FEATURES/comprehensive-wiring-plan-2026-08-20.md`.
⛔ The original line read *"**Status: PLANNING.** Not yet `dev-collab-scope`'d, not built"* — true the day it was written, false from the next day, and never corrected. This doc answers Max's two planning questions per workstream —
**(1) what features make this real, (2) how we'll know each is done** — it deliberately does NOT specify every
implementation step (that's the `dev-collab-scope` → `writing-plans` job, on the dedicated branch).

Produced by 4 parallel `code-architect` subagents (2026-06-23), each grounded in and **spot-checking** the design
docs against real code. Several design-doc claims were corrected against the code — see "Findings that reshaped
the docs." Parent design: [`world-engine-architecture-spine.md`](world-engine-architecture-spine.md) +
[`world-engine-wf2-synthesis.md`](world-engine-wf2-synthesis.md). Pickup map:
[`world-engine-INDEX.md`](world-engine-INDEX.md).

---

## ⭐ The one decision that bounds the whole effort — ✅ LOCKED 2026-06-23: LAB-ONLY (Max)

**Does the production-L1 port target the LAB renderer only, with the shipped GAME shader demotion deferred?**
→ **Max decided 2026-06-23: LAB-ONLY.** The `Planet.js` game-shader demotion (WS3 F5) is a separate, deferred
workstream and is OUT of scope for this port.

There are **two unrelated renderers** (see [`lab-vs-game-renderer-divergence.md`](lab-vs-game-renderer-divergence.md)):
- **Game** — `src/objects/Planet.js`: a 40+ branch `if (planetType == N)` shader gated by `_typeIndex()`
  (`Planet.js:1262`), fed by `_pickType` + `ExoticOverlay` type-swaps. **Type is fully load-bearing.** This is the
  shipped, player-facing renderer.
- **Lab** — `planet-lod-lab*` / `planet-lod-lab-core.js`: already driver-derived; `deriveUniforms`
  (`planet-lod-lab-core.js:496`) is explicitly "no type branch". The world-engine + the proven relief slice + the
  river router all live here.

**Both WS3 and WS4 planners independently recommend: target the LAB; treat the game-shader port as a separate,
very-high-blast-radius, deferred workstream that needs its own scope.** That keeps the L1 port bounded. The
alternative — rewriting the shipped `Planet.js` shader as part of this effort — is a much larger, player-facing
change with no current plan. **Recommendation: lab-only; defer the game-shader port. ✅ Confirmed by Max 2026-06-23.**

---

## Findings that reshaped the design docs (all VERIFIED against code)

1. **The "D1–D16 driver vector" is a documentation abstraction, not a runtime object.** `planet-drivers.js` is at
   the **repo root**, not `docs/FEATURES/` (the INDEX:114 + CHARTER:46 cite is STALE). The game pipeline does not
   import it or emit a D-vector; `PlanetGenerator.generate()` returns an ad-hoc `planetData` object
   (`PlanetGenerator.js:660-688`). So "surface D13/D16" concretely = "add named keys to that returned object."
2. **WS4's framing is half-stale — production already has a sphere-native hydrology router more advanced than the
   lab slice.** `planet-lod-rivers.js` builds an irregular spherical-Delaunay mesh, reads the real GPU height field
   back via RTT, and runs priority-flood + flat-resolve + D-inf routing + Horton-Strahler order (`routeAndOrder:283`)
   directly on the sphere graph. **The "cubemap-seam lake breakage" hazard does not exist in this pipeline** (the
   router is seam-free by construction; the carve cube is direction-keyed). So WS4 is **NOT** "port the flat-DEM E9
   code" — it's (a) author the **missing E6 structural-grain field** and (b) make the existing carve **genuinely
   subtractive** over a shared substrate.
3. **The real gap WS4 closes** (flagged in NOW.md 2026-06-21): today the only shared driver is `gProvince` (a scalar
   amplitude mask); every relief feature **hashes its own independent strike axis** (`uOrogenyAxis`, `uScarpAxis`,
   `uTesseraAxis`, …). There is **no shared orientation/lineament field**. E6's grain field is exactly that missing field.
4. **A second, independent type-picker exists:** `MoonGenerator._pickType` (`MoonGenerator.js:312`), not mentioned in
   the design docs. E1 (WS3) must serve moons too, or moons stay type-first while planets go driver-first.
5. **`deriveComposition` (`PhysicsEngine.js:341`) is already driver-based** — wf2-synthesis §6 calls it "the master
   threshold cascade" in the present tense, but it's the **target template** for E1, not a current conflict. The
   present master gate is `_pickType` (`PlanetGenerator.js:710`).

---

## Dependency order across the four workstreams

```
WS1 (L0 plumbing) ──► WS2 (Tier-1 base step) ──► WS4 (wire E6→E9 into renderer)
       │                                              ▲
       └──► WS3 F1 (E1 emits derived label) ──────────┘
            WS3 F2–F4 mostly lab-side, incremental, parallelizable
```
- **WS1 is the unconditional prerequisite** — lowest blast radius, additive; everything downstream needs real D12 /
  eccentricity / the exposed system graph.
- **WS2** consumes WS1 and derives the grain/stress/interior fields WS4's E6 reads. Can be built against a shim
  (the lab's self-derivation) while WS1 lands.
- **WS3** F1 (E1 label) is foundational; F2–F4 are incremental and can run alongside.
- **WS4** depends on WS1 + WS2.

Suggested scope/build sequence: **WS1 → WS2 → (WS3 F1 ∥ WS4)**, with WS3 F2–F4 folded in incrementally.

---

## WS1 — L0 plumbing track (unconditional; lowest blast radius)

**Goal:** Make L0 hand down the drivers + system context L1 needs — un-zero the dead tidal spine, compute
eccentricity, surface three dropped primitives, expose the system graph. Adds *outputs*; doesn't change rendering.

**Features**
- **F1 · Un-zero D12 tidalHeating** — wire the real `tidalHeating()` (`PhysicsEngine.js:295`) into the generators;
  it's hard-zeroed inline at `PlanetGenerator.js:565`. *Stronger than docs:* it's dead in **both** planets AND moons
  (`MoonGenerator` never calls it) — fix both. Needs F2 first (eccentricity is arg 1). **Blast: medium** (changes
  `surfaceHistory.resurfacing`, which renderers already read → some bodies will look different).
- **F2 · Compute orbital eccentricity** — `circularize()` (`PhysicsEngine.js:321`) is dead; orbits are circular by
  construction. *Not "un-comment" — must first **seed** an initial eccentricity (deterministic rng), then damp.*
  **Blast: low** if data-only.
- **F3 · Surface magneticField (D13)** — computed inline twice (`PhysicsEngine.js:168`, `PlanetGenerator.js:421`),
  surfaced never. **Blast: low** (additive).
- **F4 · Surface age (D16) + metallicity** — both already available, dropped from the return. ~2-line plumb.
  **Blast: low.**
- **F5 · Expose the system graph** — siblings/moons/rings/companion/resonances are computed one level up
  (`StarSystemGenerator.js`) *after* the body exists; the body only carries `moonCount`. Needs a **second pass** to
  back-link. **Blast: low-med** — a live `planetData._system = systemData` ref is **circular** → breaks JSON
  save/share; use a **flat derived `systemContext` summary**.

**Done-criteria** (layer in parens)
- F1: tidally-heated body → `planetData.tidalHeating > 0`, cold body ≈ 0 (unit); value flows into `resurfacing`,
  before/after seed-sweep snapshot quantifies the visual delta (integration); bodies read more-resurfaced, nothing
  else regressed (Max UAT).
- F2: `eccentricity` present, in `[0,1)`, deterministic per seed; feeds F1's call not a literal (unit/integration).
- F3: `magneticField` present and **equals** the value aurora/atmosphere already use — single source (unit).
- F4: `age`/`metallicity` equal the system values (unit equality).
- F5: from any body, resolve siblings/own-moons/resonance-partners/companion; known resonant seed matches
  `resonanceChain` (unit); `JSON.stringify(systemData)` still succeeds — no circular ref (integration); live
  `window.__wd.*` shows real siblings (chrome-devtools).

**Build order:** F4 + F3 (trivial warm-up) → F2 → F1 → F5.

---

## WS2 — Tier-1 base step (the new thin L1 derivation layer)

**Goal:** The production "expose + derive" base step that consumes WS1 and derives the structured fields the engines
need (orientation/grain, stress tensor, field-topology, a thin interior field). Production generalization of the
lab's `relief-base-step.js` (flat 2D, single-body, self-stubbed) → real sphere, system-aware. *Derivation =
history-writing lives here.*

**Features**
- **F1 · Base-step interface + substrate contract** — the production analogue of `relief-substrate.js` +
  `makeBaseStep`'s `{drivers, crust, substrate}`. Recommend a NEW `src/worldengine/base/` tree (do **not** touch
  `src/generation/` — that's the whole point of Option A). **Blast: low** (additive); risk is interface design.
- **F2 · L0 consumption adapter** — reads WS1's plumbed outputs, normalizes into the base-step input. **Hard dep on
  WS1**; until WS1 lands, falls back to the lab's self-derivation (`deriveUniforms` tidal math,
  `planet-lod-lab-core.js:516-529`). **Blast: low** (read-only adapter).
- **F3 · Sphere/cubemap field parameterization** — promote the flat lat-band grid (`latDegOfRow`,
  `relief-substrate.js:21`) to seam-correct spherical adjacency. **Blast: medium** — the lab's single biggest
  un-validated generalization; build an isolated sphere-field harness first. *(NB: WS4 found production's river
  router is already sphere-native and seam-free — reconcile F3 with that; the seam hazard may be smaller than feared.)*
- **F4 · Orientation field + stress tensor** — generalize the lab Melosh stress → grain + Anderson regime
  (`relief-e6-tectonic.js`) to per-texel on the sphere. Deps F1/F2/F3. **Blast: low-med** (physics proven in lab).
- **F5 · Thin interior field** — crustal thickness / lithosphere (E6), Love numbers (E3), thermal/age (E7). Lab only
  stubs this. **Blast: medium** — least lab-proven; **open: base step vs a small E0-interior engine.**
- **F6 · Field-topology maps** — dipole/magnetosphere topology (E4/E2). No lab precedent; no first-wave consumer →
  **deferrable** behind F4/F5. **Blast: low** (additive, lower confidence).
- **F7 · Determinism + base-step verifier** — port the lab determinism contract + a field-level verifier (finite,
  bounded, seam-consistent, physically ordered). **Blast: low** (test code) — this is the workstream's gate.

**Done-criteria**
- F1: a downstream engine stub reads every declared field without a v2 change (unit).
- F2: high-ecc close-orbit body → `drivers.tidalHeat > 0` and > a circular control; system graph non-null
  (unit/integration vs WS1).
- F3: neighbor indexing continuous across all seams; smooth global function reads continuous across seams (unit →
  live).
- F4: equator→thrust / mid-lat→strike-slip / pole→normal; contraction-sign biases thrust (unit); **interior field
  feeds E6, relief responds to crustal thickness** (integration cross-engine signal).
- F5: crustal thickness bounded/low-freq/physically-ordered; Love + thermal fields non-null; **E6 relief amplitude
  tracks crustal thickness** (the "upstream of relief" proof) (unit → integration → UAT).
- F6: dipole map finite/bounded; E4-shaped reader consumes it (unit; no live until E4 ported).
- F7: same `(bundle,opts,seed)` → byte-identical fields; verifier passes on the 4 bundles + flags a corrupted field
  (unit — the WS gate).
- Cohesive (Max UAT): switching bundles produces categorically different fields → categorically different relief
  (production analogue of the lab's `divergenceReport`).

---

## WS3 — Type → derived-label demotion (HIGH blast radius)

**Goal:** "Type" becomes a **derived label** read off E1's composition/driver output, never an upstream gate.
Replace each type lookup with a driver/field threshold. *Drivers + fields decide; the type string only names.*

**The conflict-site map (the backbone; sites VERIFIED file:line)**
- *Game-side (type-as-input — high coupling; owned by the deferred game-port unless Max pulls it in):* `_pickType`
  (`PlanetGenerator.js:710`) + type-keyed tables (`:326–570`); `MoonGenerator._pickType` (`:312`); the 40+ branch
  shader (`Planet.js:253-819`, `_typeIndex:1262`); `computeAtmosphere` type early-return (`PhysicsEngine.js:145-153`);
  `ExoticOverlay` type-swap+regen (`ExoticOverlay.js:286-323`).
- *Lab-side (type-as-label — ~80% already done; the real WS3 target):* `rendersOn` allowlists
  (`planet-feature-associations.js:46…`, a **live render-gate** via `applyDrivers`→`featureRelevant`,
  `world-engine-lab.html:2701-2712`) + `featuresOf`/archetypes (`planet-archetypes.js`); `DRIVER_PRESETS` parallel
  named-bundle table (`world-engine-lab.html ~:5326`).

**Features**
- **F1 · E1 emits `type` as a derived label** — pure fn (new `world-engine/E1-composition.js`) over drivers+context →
  `{regime, compositionClass, basePalette, type}`; `deriveComposition` is the kernel. **Blast: high** (defines the
  vocabulary the whole stack keys on). Incremental: emit alongside `_pickType` and diff first.
- **F2 · Replace `rendersOn` allowlists with driver-threshold gates** (the biggest lab conflict) — `featureRelevant`
  derives from each feature's own driver gate, not preset-name membership. **Blast: high** (live render-gate AND the
  audit oracle). Incremental: keep `rendersOn` as a derived-and-asserted equality check, flip only when derived ==
  declared, then delete the hand list.
- **F3 · Demote `computeAtmosphere`'s type early-return** — derive massive-retention from mass/temp/gravity (the
  Jeans machinery already below it). **Blast: med-high** (atmosphere drives many gates). Must be regression-pinned hard.
- **F4 · `ExoticOverlay` stops erasing derived history** — additive overlay (E14/E12) instead of `forceType`+regen.
  **Blast: medium.** Sequence last.
- **F5 · Game type-branch shader demotion** — **SCOPE GATE: recommend OUT of WS3**, folded into the deferred
  game-port. **Blast: very high** (the shipped renderer).

**Done-criteria**
- F1: `E1(drivers).type == _pickType(...)` for ≥99% of a 5000-seed census; <1% divergences reviewed/intentional (unit).
- F2: per (feature × preset), derived `featureRelevant == ` current `rendersOn` membership, or a logged Max-approved
  correction (unit + lab integration).
- F3: same `{retained, composition, pressure-class}` for all current type+orbit combos, derived from mass/temp/gravity (unit).
- F4: exotic body **retains** its pre-overlay derived drivers (unit diff).
- **Regression-safety gate (the critical one):** (a) generation golden-data — snapshot
  `generate`+`deriveUniforms` over a fixed seed×orbit×type grid, assert byte/tolerance-identical after each feature
  except logged intentional changes (cheap, runs first); (b) lab golden-image — 17 `DRIVER_PRESETS` at a fixed seed,
  GPU capture before/after within tolerance (chrome-devtools `:9223`). Any intended change = a named entry in a
  demotion change-log.

**Migration (recommend, don't ask):** incremental, label-alongside-input, per-feature golden gate — never big-bang.
**Carve-out (R3):** some features (hexTess, shatter, overlays) are pure-enable lab knobs with **no driver class** —
keep them as a named "overlay/enable" category, don't force them into driver gates.

---

## WS4 — Wire relief engines (E6 build → E9 carve) into the renderer

**Goal:** A real planet's tectonic structure + drainage emerge from the L1 relief engines over a shared mutable
substrate; the renderer only *expresses* it. Concretely: replace "every feature hashes its own strike axis" with one
E6-authored grain field that mountains/scarps/tessera/canyons AND the river router read — closing the shared-lineament
gap. **Reframed from the docs:** not "port the flat-DEM engines" — author the missing E6 grain field + make
production's existing sphere carve genuinely subtractive.

**Features**
- **F1 · E6 structural-grain field, baked per body (keystone)** — per-body sphere-native grain
  (`grainAngle`/`grainMag`/`regime`) from the E6 Melosh + radial-strain math (`relief-e6-tectonic.js` = math
  reference, not drop-in). New `planet-lod-tectonic.js`; derivation in `deriveUniforms`; consumed in
  `planet-lod-height.glsl.js` (replace per-feature axis hashing at `initProvinces:797` / `fbmdRidged:880`). Dep:
  WS2 base step + WS1 D12. **Blast: high** — gate behind `uTectonicGrainStrength` (0 = byte-identical fallback).
- **F2 · Wire the existing sphere router as production E9 (subtractive carve)** — promote the cosmetic carve to a
  true host-edit: routed drainage **subtracts** from the authored relief (stream-power `dz=-K·A^m·S^n`), so a 2nd
  route sees the carved surface. `planet-lod-rivers.js` `routeAndOrder:283` + `buildValleyGeometry:595` already
  exist. Dep: F1. **Blast: med-high** — must keep the router-lab zero-drift regression green.
- **F3 · Epoch ordering (build-then-carve as two passes)** — epoch 1 E6 authors + snapshot `heightAfterBuild`;
  epoch 2 E9 routes on the snapshot + subtracts. Orchestration host = `createRiverOverlay:797`. Dep F1+F2. **Blast: low-med.**
- **F4 · Bake-timing integration with LOD/regen** — once-per-body bake (reuse `ensureMesh`/`route` lazy lifecycle);
  re-bake only on preset/seed/sea-level change. **Blast: low** (stale-cache risk).
- **F5 · Renderer stays expression-only** — audit that the shader reads the grain/substrate and decides nothing.
  **Blast: low** (a constraint) — but it's the architectural point.

**Done-criteria**
- F1: stress/regime reproduces the lab oracle (equator→thrust etc.); deterministic per `(drivers,seed)`; one field
  read by N consumers (unit/integration); A/B `uTectonicGrainStrength` 0 (byte-identical) vs 1 (mountains/scarps/
  canyons visibly share a strike) (live chrome-devtools `:9223`).
- F2: strictly subtractive (carved ≤ authored ∀ vertex); carve correlates with relief; 0 uphill/orphan edges (unit);
  router-lab zero-drift stays green — ocean 35%, maxStrahler 5 (integration); **sphere-mapping correctness** = both
  poles clean, lakes intact (replaces the moot cubemap-seam test).
- F3: build-only bit-identical through epoch 1; epoch 2 only lowers height (unit); epoch-2 off/on reads as "uncut
  relief" vs "drainage carved into the SAME relief" (live — the production-sphere version of the lab proof shots).
- F4: bake count = 1 per preset/seed; not per-frame; re-bakes on change; within budget (integration/live).
- F5: no strike-axis derivation / amplitude decision left in the shader for grained features (code audit).
- **UAT (Max alone):** a real planet reads as a landscape with a history — drainage post-dates and cuts a tectonic
  relief whose features share a coherent grain.

---

## Decisions needed from Max (consolidated)

**Bounding decision (must answer before scoping):**
1. **Lab-only vs include the game shader?** → ✅ **DECIDED 2026-06-23: lab-only.** The `Planet.js` game-shader port
   (WS3 F5) is deferred to its own workstream, OUT of scope here.

**Has a clear recommended default — flag if you disagree, otherwise we proceed on the default:**
2. Eccentricity (WS1 F2): **data-only** in WS1 (don't make visible orbits elliptical yet) — keeps blast radius low,
   decouples from the parked warp/rebasing work.
3. System graph (WS1 F5): **flat derived `systemContext` summary**, not a live back-reference — avoids the circular-ref
   save/share break.
4. Interior field (WS2 F5): **keep in the base step** for the first wave; extract an E0-interior engine only if it grows.
5. Production tree location: **`src/worldengine/base/…`** (leave `src/generation/` untouched).
6. E6 grain vs existing `gProvince` (WS4): **augment** (province = amplitude/where; grain = orientation/regime), not replace.
7. E1 serves moons too (WS3 R5): **yes** — fold `MoonGenerator._pickType` into the same derived-label path.

**Needs a number from Max (can start with a default, refine):**
8. Per-body bake budget (WS4): target "seconds, not per-frame"; sets the E9 incision-pass count (lab uses 5) and
   whether a 2nd route is needed.

## Deferred cleanups (logged, non-blocking)

- **Magnetic-field lock-predicate unification (from WS1 AC3, 2026-06-24).** `computeAtmosphere`'s internal
  atmosphere-stripping field proxy (`PhysicsEngine.js:167-168`) uses a cruder lock test (`|rotationSpeed|<0.01`,
  treating 3:2-resonance as fully locked → ×0.2) than the canonical surfaced `planetData.magneticField` dynamo value
  (`lockType==='synchronous'` → ×1.0 for 3:2). The dynamo test is the more physically correct one. Unifying is a
  deliberate BEHAVIOR CHANGE (alters 3:2-resonance atmosphere retention) → needs its own verify + Max UAT; left out
  of additive WS1. Fold into WS2 or a small follow-up.

---

*Next step (per the handoff + INDEX §1): create a dedicated branch off `master`, then `dev-collab-scope` the first
workstream (WS1 — unconditional) into `intent.md` + `contract.json`, then `writing-plans` → build → `verify-workstream`.*
