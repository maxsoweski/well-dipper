# Stage-C Status — planet rendering, lab implementation

**Date opened:** 2026-06-06 · **Project:** `~/projects/well-dipper` (three.js r183.1 / WebGL2) · **Branch:** `master` (local-only lab work).
**Governing contract:** `research/stage-b/RESEARCH_stage-b-00-INTEGRATION-INDEX-2026-06-06.md` (read it first — §1 uniforms, §3 pipeline order, §7 sequence).
**Frame:** ground-up NEW system, no parity-with-old, no `planetType` branch, single shader behind `qualityTier`+`lodRamp`, emissive bypasses posterize. (Stage-A spec `docs/superpowers/specs/2026-06-06-planet-rendering-foundation-design.md`.)

This file is the running Stage-C progress tracker — each session updates it. Stage-A foundation = `c4a94b3`, Stage-B research = `d309add`.

---

## Step 1 — shared-libs foundation (index §7.1)

The contract the 8 domains build against. Lower-risk scaffolding EXCEPT sub-step 1.1 (the risk-#1 spike), which is done.

| # | Sub-step | Status |
|---|---|---|
| 1.1 | **`voronoi3d()` keystone + seam-gate spike** (risk #1) | ✅ **DONE** — `262f63a` |
| 1.2 | `emissiveBlackbody(tempK)` GLSL helper (shared: Bands thermal F32/F33, Exotic magma F41) | ⬜ next |
| 1.3 | Canonical uniform registry (index §1's 11 shared-name rows — declare ONE name each) | ⬜ |
| 1.4 | Single `vSubstellarAngle` varying, computed once (consumers: Bands, Clouds, Cryo, Optical) | ⬜ |
| 1.5 | §3 pipeline-order skeleton in the mega-shader | ⬜ |

### 1.1 — voronoi3d keystone (DONE, `262f63a`)

The shared 3D cellular primitive three domains route through (relief craters F2, cryo pits/polygons, exotic hex/crystal/shatter). Built ONCE per index §1 — **do not fork parallel primitives.**

- **CPU oracle** `planet-lod-lab-core.js` → `voronoi3d(p, cells)` returns `{f1, f2, cellId, toCenter, grad}`. `grad = ∂F1/∂p = normalize(p − center)` — the relief-normal contribution.
- **GLSL** `planet-lod-lab.html` → `voronoi3d(vec3 p, int cells, out vec3 cellId, out vec3 grad)` + `hash33` (transcribed from the oracle, same hash constants). Behind a temporary `▸ Debug — voronoi3d spike` lil-gui folder (modes: F1 / F2−F1 borders / cell-id color / lit relief).
- **Tests** `tests/planet-lod-voronoi.test.js` — 8, TDD'd (RED→GREEN). Analytic gradient pinned vs central finite-difference (the relief-doc §5.4 silent-bug guard); F2≥F1; determinism; the 27-vs-9 cost/quality invariant.
- **Live-verified on `:9223`** (screenshots `voronoi-spike-01..06`): **27-cell is seam-free at the pole, across all meridians, with correct analytic-normal lighting and a clean F2−F1 border network.** 3D-domain (sampled on `vPos`) is seam-free by construction — the reason to pay for 27 cells. Debug OFF → Stage-A render unchanged (no regression).

**→ Risk #1 (index §5, the single highest-priority spike) is CLEARED on cycle 1.** It gated every cellular feature; cellular work is now unblocked.

### Carry-forward for sub-steps 1.2–1.5
- The `▸ Debug — voronoi3d spike` folder is a **temporary harness tool** — remove (or fold into a permanent debug panel) once the foundation lands; it's not a planet feature.
- `voronoi3d`'s `cells` param is the `qualityTier` 27↔9 knob's GPU side. Wire it to `uVoroCells`/`craterCells` from `deriveUniforms` when craters land (Stage-C step 3, Relief).
- `emissiveBlackbody` should sit beside the noise/voronoi shared libs in the shader and (CPU-side, if a JS mirror earns a test) in `planet-lod-lab-core.js`.

---

## Open Max-decisions surfaced during Stage C (don't invent answers)

Index §4 carries the original 7. Added during implementation:

- **A. Mobile cellular path (NEW, from the 1.1 spike).** The 9-cell mobile fallback, done as a simple center-slab search, is **lossy/anisotropic** — cells stretch along the dropped axis (screenshot `voronoi-spike-05`); no hard seam, but not crater-quality. Per the index §5 fallback ladder (`27-cell → drop mobile cellular → albedo-only facets`), this points toward **drop mobile cellular → smooth relief** (spec already lists mobile as untuned-for-now) rather than shipping the stretched cells. Desktop-primary 27-cell is clean. **Not a blocker** — surfaced for when Max tunes the mobile tier. A better reduced search (pruned neighborhood) could be revisited if mobile cellular is later wanted.

---

## Next session picks up at: **Step 1.2 — `emissiveBlackbody(tempK)`**, then the uniform registry (1.3).
Each domain (after step 1 + the step-2 generation surfacings) implements directly from its `research/stage-b/RESEARCH_stage-b-<domain>-*.md` doc. Index §7 is the dependency-ordered sequence (Relief lands the shared Voronoi consumer first, then the parallel fan-out).
