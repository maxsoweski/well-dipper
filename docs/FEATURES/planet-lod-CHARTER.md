# ⭐ Planet-LOD Lab — CHARTER (read this FIRST, before any LOD-lab work)

**This file is the strategic frame. It changes rarely.** Tactical status lives in
`planet-lod-campaign-tracker.md` (feature-by-feature) and `../NOW.md` (live micro-state).
Read THIS first so you don't lose the wider context — that loss is a known recurring
failure mode across fresh sessions. If a handoff and this charter disagree on the *frame*,
this charter wins (handoffs are per-session and drift).

## Why we're doing this (the heart of it)
Mature the **planet-LOD lab renderer** to the quality bar for the **SCREENSAVER-MVP**
(`HEART_OF_DESIRE.md`): planets/moons are the hero objects on screen. The lab is where
that visual polish is developed.

## ⭐ NORTH STAR — FEATURES WORK TOGETHER (co-dependence) — ALWAYS (Max, 2026-06-19)
**Every piece of terrain work in this lab — global generation AND view-dependent LOD detail —
must take the OTHER features into account. This is the standing north star; it appears here,
at every session start, and in every handoff.** Concretely:
- **Rivers respect MOUNTAIN topology** — drainage flows around/down the real relief, never ignores it.
- **Rivers FEED the ocean** — they terminate at the coast and flow INTO the sea. They must NOT
  "float on top of" the ocean (e.g. a carve/LOD that incises over water cells = missing the mark).
- **Downstream features stay keyed to the real drainage** — deltas/outflow/coastlines derive from
  the actual routed network (the shipped fluvial-coupling pattern), at LOD scale too.
- Generalizes to all structured features (mountains↔canyons↔scarps→coherent massifs, etc.).
A feature that looks right in isolation but ignores its neighbours is WRONG here. When adding LOD
detail, the local regeneration must READ the other features' fields (height-with-mountains, sea
level, coast) so finer detail stays consistent with the global coupling — not just look plausible alone.

## The single most important structural fact: the lab ≠ the game (BY DESIGN)
There are **two unrelated planet renderers** (full detail + the deferred-port decisions:
[`lab-vs-game-renderer-divergence.md`](lab-vs-game-renderer-divergence.md)):
- **Game** (`src/objects/Planet.js`) — the shipped, March-2026 **type-branch** shader
  (`if (planetType==N)`), gated by a `type` string via `ExoticOverlay`. This is what
  players see today.
- **Lab** (`planet-lod-lab.html` + `planet-lod-lab-core.js`) — a **feature-composition**
  renderer (provinces + the F1–F51 campaign). This is the next-gen renderer in development.

They share **zero shader code**. They do, however, already share the **physics**: the lab imports
20+ modules from `src/worldengine/` (`sphereField`, `tectonic`, `plates`, `magmatism`,
`surfaceMaterial`, `albedoTransfer`, `bombardment`, `province`, `climate-e5`, `storm-e`, …). The
world engine lives in the game's tree in ONE copy and the lab is a consumer of it.

> ### ⛔⛔ REVERSED 2026-07-31 / 2026-08-01 (Max) — GAME-WIRING IS NOW THE ACTIVE JOB
>
> This section used to end "**do NOT start game-wiring** — the job right now is making the lab
> itself good," and the program list below used to call the game-port deferred and out of scope.
> **Both are now wrong and are corrected in place.** Max's directive, verbatim:
>
> - *"the goal here is to have the lab's rendering pipeline in the game — the procgen and the
>   rendering itself. go forward in whatever way will make that happen asap."* (2026-07-31)
> - *"we change the rendering capabilities of the main game however we need to such that the
>   features of the world engine can render in the main game."* (2026-08-01)
> - *"we will likely do additional development in the world engine lab, and so we need to easily be
>   able to move the latest developments from that lab into the main game in the future."* (2026-08-01)
>
> **⭐⭐ THE PLAN OF RECORD IS [`one-pipeline-two-frontends-PLAN.md`](one-pipeline-two-frontends-PLAN.md).**
> Read it before doing any of this work. It is the durable, multi-session tracker; per-session
> handoff briefings are disposable and have twice been wrong about what had already shipped.
>
> ⛔ **CORRECTED 2026-08-19. THIS LINE USED TO NAME [`lab-pipeline-into-game-PLAN.md`](lab-pipeline-into-game-PLAN.md),
> WHICH HAS BEEN SUPERSEDED SINCE 2026-08-06** — that file's own successor says so at
> `one-pipeline-two-frontends-PLAN.md:4` (*"Supersedes the sequencing in
> `docs/FEATURES/lab-pipeline-into-game-PLAN.md`"*), but nothing propagated the change back here.
> ⭐ **This was not a cosmetic staleness.** CLAUDE.md sends every planet-LOD session to this charter
> FIRST, so the wrong pointer routed the reader into a plan whose six-layer status table is false on
> three of six rows — layer 0 reads `TODO` when its deliverable shipped as the successor's Step 1
> (`0af246e`, 2026-08-06). It cost a session on 2026-08-19, which opened the superseded plan and came
> within one step of rebuilding a condition contract that already existed. The predecessor's
> DIAGNOSIS and its MEASUREMENTS are still cited and still good; only its SEQUENCING is dead.
>
> What still holds from the old framing: **do NOT chase "game bugs" from lab behaviour** while the
> two renderers differ. What no longer holds: "no parity goal" (parity IS the goal now), "which
> features ship" (all of them), and "not until the lab is mature" (the lab will keep evolving —
> that is precisely why the seam has to be shared modules rather than a one-time port).

## The model already exists — do NOT re-invent it
A complete physics-first model was authored up front and is the source of truth:
- **`planet-visual-features.md`** — L0 drivers **D1–D16** → L1 processes **P1–P28** → L2
  features **F1–F53**, + Appendix A (all 18 planet types → their features).
- **`planet-drivers.js`** — that model as code: `DRIVERS` (D1–D16) + `PROCESSES` (P1–P28).
- The game's **`src/generation/PhysicsEngine.js`** already *computes* these drivers
  (composition, atmosphere, magnetosphere, tidal, `habitabilityScore` as a result of the others).
If you find yourself asking "is the planet-type/feature model laid out?" — yes, it is, here.

## ⭐ INTENT FRAME — the world engine is a physics simulation (Max, 2026-07-19)
**The defining intent, in Max's words:** "for terrain and atmosphere features, I want to
replicate what we've observed in the real world and extrapolate from there based on real
theories/speculation about what else is out there in the universe." Operationally:
- **Physics-derivable questions are Claude's to answer, not interview forks for Max.** The
  scoping algorithm: enumerate the drivers that would physically determine the feature (or the
  interaction) → figure out the real-world relationships → wire them → proceed. Bring Max only
  taste/product calls physics cannot resolve, batched.
- **No defaults.** Presets are dev fixtures / named-body locks. The real object is seed-drawn
  worlds whose condition vectors come from the generation distributions; calibration and
  acceptance target the drawn POPULATION, not a hand-tuned boot state.
- **Driver completeness before UAT** — every relevant driver wired, or explicitly surfaced as
  unwired, before any UAT ask (`feedback_wire-relevant-drivers-before-uat.md`).
- Max's gates: greenlight + UAT. Everything between is physics + verification.
Full rule + provenance: `feedback_physics-first-worldengine-scoping.md` (Claude memory, Rule 12 link).

## The program (where the arc is going)
1. **Catalog — ✅ DONE (2026-06-14).** All 47 manifest features re-based on the canonical
   D1–D16 model; `planet-feature-associations.js` declares `processes:[P#]` and DERIVES
   `dependsOn.drivers` (drift-proof). Driver column closed; overlays driven by `habitability`.
2. **Per-feature quality pass — ◀ CURRENT.** Walk each feature vs reference, adjust the
   shader, via the **campaign per-feature UAT loop** (spec §13). The Tier-2 render-delta
   sweep already produced a punch-list (109 false-renders / 85 dead-renders) to triage
   manifest-wrong vs feature-buggy. Tracker is the per-feature status.
3. **Integration** (cross-feature) and **profiles** (per-type) — later campaign phases.
   Integration (Phase 5) is now operationalized by the feature-interaction audit
   ([`feature-interaction-audit-2026-06-20.md`](feature-interaction-audit-2026-06-20.md)) →
   build plan in [`planet-lod-phase5-integration-plan.md`](planet-lod-phase5-integration-plan.md)
   (52 gaps → WS1–WS5 + cross-cutting; serves the NORTH STAR directly).
4. **Game-port — ◀ NOW ACTIVE, RUNNING IN PARALLEL (reversed 2026-07-31, see the box above).**
   No longer deferred and no longer gated on lab maturity. Plan of record:
   [`lab-pipeline-into-game-PLAN.md`](lab-pipeline-into-game-PLAN.md).

## Current position
**Two arcs run at once.** Phase 2 (per-feature quality) continues in the lab —
`planet-lod-campaign-tracker.md` for which feature is next (▶️ row). The game-port arc runs
alongside it; its status is in [`lab-pipeline-into-game-PLAN.md`](lab-pipeline-into-game-PLAN.md),
never here (this file changes rarely, by design). `../NOW.md` for live micro-state.

⭐ **The two arcs are not in tension, and that is a design goal, not luck.** The port's whole shape
is "extract the lab's pipeline into modules the lab imports back," so continued lab development
lands in the game for free. If you ever find yourself choosing between improving the lab and
porting to the game, the seam has been built wrong — stop and fix the seam.

## How to work here (pointers, not a re-teach)
- **Test via chrome-devtools GPU `:9223`, NOT Playwright** → [[well-dipper-testing-reference]]
  + the tracker's per-feature process lessons (grad-routing, isolation recipe, line-number drift).
- **Shared working tree** — stage explicit paths only, **never `git add -A`** (warp WIP + loose
  .png/.webm/.html litter the tree).
- Subagents: pin an explicit model on every call; `fable` granted by Max (2026-07-19) for
  judgment-heavy stages, `opus`/`sonnet` for mechanical ones (`feedback_subagent-model.md`).
