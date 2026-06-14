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

## The program (where the arc is going)
1. **Catalog — ✅ DONE (2026-06-14).** All 47 manifest features re-based on the canonical
   D1–D16 model; `planet-feature-associations.js` declares `processes:[P#]` and DERIVES
   `dependsOn.drivers` (drift-proof). Driver column closed; overlays driven by `habitability`.
2. **Per-feature quality pass — ◀ CURRENT.** Walk each feature vs reference, adjust the
   shader, via the **campaign per-feature UAT loop** (spec §13). The Tier-2 render-delta
   sweep already produced a punch-list (109 false-renders / 85 dead-renders) to triage
   manifest-wrong vs feature-buggy. Tracker is the per-feature status.
3. **Integration** (cross-feature) and **profiles** (per-type) — later campaign phases.
4. **Game-port** — the deferred, separate, no-parity effort. NOT in scope until the lab is mature.

## Current position
Phase 2 (per-feature quality). See `../NOW.md` for the live micro-state and the latest
handoff, and `planet-lod-campaign-tracker.md` for which feature is next (▶️ row).

## How to work here (pointers, not a re-teach)
- **Test via chrome-devtools GPU `:9223`, NOT Playwright** → [[well-dipper-testing-reference]]
  + the tracker's per-feature process lessons (grad-routing, isolation recipe, line-number drift).
- **Shared working tree** — stage explicit paths only, **never `git add -A`** (warp WIP + loose
  .png/.webm/.html litter the tree).
- Subagents: `model: opus` (fable unavailable here).
