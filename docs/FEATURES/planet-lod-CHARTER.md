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

They share **zero shader code**. Wiring the lab into the game is an **explicitly deferred,
no-parity, separate effort** (Max-approved campaign spec, 2026-06-09) with **no plan/scope
yet**. So: **do NOT chase "game bugs" from lab behavior, and do NOT start game-wiring** — the
job right now is making the lab itself good.

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
4. **Game-port** — the deferred, separate, no-parity effort. NOT in scope until the lab is mature.

## Current position
Phase 2 (per-feature quality). See `../NOW.md` for the live micro-state and the latest
handoff, and `planet-lod-campaign-tracker.md` for which feature is next (▶️ row).

## How to work here (pointers, not a re-teach)
- **Test via chrome-devtools GPU `:9223`, NOT Playwright** → [[well-dipper-testing-reference]]
  + the tracker's per-feature process lessons (grad-routing, isolation recipe, line-number drift).
- **Shared working tree** — stage explicit paths only, **never `git add -A`** (warp WIP + loose
  .png/.webm/.html litter the tree).
- Subagents: pin an explicit model on every call; `fable` granted by Max (2026-07-19) for
  judgment-heavy stages, `opus`/`sonnet` for mechanical ones (`feedback_subagent-model.md`).
