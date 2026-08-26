# Rivers sphere-seam viability spike — plan & criteria (2026-06-17)

> Companion to `rivers-dendritic-drainage-research-2026-06-16.md` (the research). This is the
> **viability spike** plan, approved by Max 2026-06-17. Theme-A item #3 in the LOD-lab quality
> backlog. Lab-renderer R&D only; game-port deferred (see `planet-lod-CHARTER.md`).

## Goal
Answer, **fast and early**, whether realistic dendritic drainage is viable for Well Dipper before
committing to the full feature. Two unknowns gate it:
1. **Seam-free routing on a sphere** — the real unsolved engineering bit (research open-problem #1).
2. **Coupling to our existing terrain** — does conforming the network to our analytic height field
   produce acceptable dendritic structure (vs. today's worm-trails)?

## Approved design decisions
- **Algorithm — HYBRID** (Max, 2026-06-17): use Génevaux Approach A's **branching grammar**
  (Horton-Strahler production rules → the dendritic tree *look*), but couple growth to the
  **existing height field `h(pos)` as the downhill constraint** and **carve channels locally** into
  `h` rather than synthesizing the macro terrain. Existing terrain is preserved and *feeds* the
  rivers; it is not rebuilt. (Rejected: pure conform-only — risks worm-trails; pure hydrology-first
  Génevaux — rivers would dictate/override the existing terrain = rebuild risk.)
- **Domain — icosphere / geodesic grid.** Single closed mesh ⇒ no seams by construction, near-uniform
  cells, no pole singularity. Routing on it *is* the seam test. Routing domain only; the bake-storage
  layout (cubemap vs octahedral) is a later, separate concern.
- **Architecture note (not rebuilt):** today the planet is a `SphereGeometry` mesh + one
  `ShaderMaterial` computing every feature analytically from `pos`; water bodies (F14) are a level-set
  `h(pos) < uSeaLevel` on the single accumulated height. Rivers committing to the bake path means one
  analytic feature becomes a sampled-texture+carve — additive, not a rebuild. The game already has a
  bake pipeline. (Confirmed by reading `world-engine-lab.html` / `-core.js`.)

## Scope honesty — what the spike proves vs. defers
- Uses a **JS stand-in height field** of the same *character* as our terrain (FBM on the sphere + a
  few large features + a sea level, tuned to ~30–40% ocean), **not** the literal production `h(pos)`.
  Viability ("can icosphere routing make sea-rooted dendritic trees, seam-free?") is answerable with a
  representative field. Tune the stand-in's roughness/sea-fraction to resemble ours so the look-read
  is honest.
- **Deferred to integration (named risk):** coupling to the *exact* production `h(pos)` via JS-port or
  render-to-texture. First scoping item *if* the spike passes; does not change the viability answer.

## Build stages (cheap, riskiest first) — isolated `rivers-lab.html` harness
- **S0** — icosphere mesh (deduplicated vertex graph w/ adjacency) + stand-in height field + sea level.
- **S1** — lowest-neighbour flow routing + drainage-area accumulation. Ocean cells (`h < seaLevel`)
  are absorbing outlets; interior local minima handled as lakes (priority-flood fill-or-route).
  **← G1 fires here.**
- **S2** — Horton-Strahler shaping: extract the tree, width ∝ √(area), acute confluences → dendritic
  *look*. **← G2 fires here.**
- **S3** *(conditional)* — light incision/carve pass, only if S2 conform-only looks weak; compare to S2.

**Viewing:** render icosphere with river cells highlighted; screenshot from **≥4 viewpoints incl.
both poles**, surfaced through a gallery (one URL for Max). Spin-check for banding at the 12
icosphere pentagon vertices.

## Success / Failure criteria (the early go/no-go)

### G1 — Seam-free routing  *(after S1 — engineering gate)*
- **PASS:** (a) 100% of channel cells have a downhill path to a sink — zero orphans, zero uphill runs;
  (b) no seam/banding/dead-zone artifact at the 12 pentagon vertices or either pole across ≥4
  viewpoints; (c) accumulation field continuous across those 12 vertices (no spike/hole).
- **FAIL:** visible seams, orphaned channels, or channels that can't reach outlets → icosphere is the
  wrong substrate → escalate to Max, **viability ↓**.

### G2 — Dendritic look  *(after S2 — coupling gate)*
- **PASS:** reads as tree-like — straightish reaches branching at acute angles into trunks that
  **widen monotonically toward the sea**; Horton-Strahler order ≥3 emerges naturally; visibly distinct
  from today's worm-trails. (Objective proxies + Max's eye.)
- **FAIL:** worm-trails / disconnected segments / no trunk-tributary hierarchy even after the grammar pass.

### G3 — Conform vs. carve  *(compare S2 vs S3 — informs scope, not a blocker)*
- Output: recommendation on whether the full feature needs the carve/erosion pass (more compute, more
  terrain modification) or conform-only suffices.

### Overall verdict
VIABLE if **G1 PASS and G2 PASS** (carve optional per G3). NOT VIABLE if G1 fails, or G2 fails even
with carve → rivers stay stylized fakes, reset expectations (per research recommendation).

### Kill condition (time-box)
If G1 can't be made to pass within **3 implement→test cycles**, stop and escalate rather than
death-spiral (standing 3-cycle cap).

## Execution
Built via gated subagents (keeps main-session context low): one builder+verifier subagent per round,
Max inspects G1 before S2, judges G2. Standing cautions: new file only (don't touch
`world-engine-lab.html` / `-core.js` / `LabMode.js`); test on `:9223` GPU Chrome via chrome-devtools at
`127.0.0.1` (server already running — don't start it); screenshots to disk → gallery, never read into
context.

## Outcome — VIABLE (2026-06-17, all gates passed; G1/G2 confirmed by Max's eye)
- **G1 (seam-free routing) — PASS.** Required an *irregular* substrate. The regular icosphere caused
  grid-locked perfectly-straight channels (cause split measured: ~66% priority-flood flats, ~34% mesh
  edge-direction snap). Fixed by rebuilding the mesh as **Fibonacci → 4× Lloyd → convex-hull spherical
  Delaunay** (~40k pts, watertight) + **Barnes-2014 flat-resolution** + **D-infinity-style routing**.
  Result: 0% orphan/uphill, seam-free at both poles, natural wobbly-straight reaches (river-scale
  median turn ~24°).
- **G2 (dendritic look) — PASS.** Horton-Strahler shaping: max order **6**, bifurcation ratio R_b
  **4.6–5.5** (natural band), width ∝ Dunne–Leopold `φ=0.42·A^0.69` grows monotonically to sea
  (**0 / 27,972** violations), Chaikin-smoothed, pruned to order ≥2. Reads as trunks widening to bays
  + acute-angle tributaries; distinct from prior worm-trails.
- **G3 (conform vs carve) — conform-only suffices.** Dendritic read is carried by routing topology +
  width law + smoothing; carve adds only a marginal valley shadow on the flat stand-in. Carve left as
  a togglable pass (`window._rivers.setCarve(true)`), **deferred to integration as polish**. Full
  feature is lighter than the research's worst case.
- **⭐ Load-bearing finding for the full-feature scope:** seam-free drainage REQUIRES irregular
  adjacency (Delaunay) — a regular grid grid-locks channels into straight lines. This was the single
  biggest surprise of the spike.
- **Deferred to the full-feature workstream (`dev-collab-scope` next):** couple to production `h(pos)`
  (JS-port or render-to-texture); bake-texture layout (flow-dir + drainage-area + signed-distance);
  shader sample+carve path; shoreline width-clamp polish (trunks slightly blobby at the sea).
- **Artifacts:** `rivers-lab.html` (harness — committed), `rivers-spike-gallery.html`,
  `screenshots/rivers-spike-*.png` (untracked, per the artifact convention).
