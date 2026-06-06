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
| 1.2 | `emissiveBlackbody(tempK)` GLSL helper (shared: Bands thermal F32/F33, Exotic magma F41) | ✅ **DONE** — `304f998` |
| 1.3 | Canonical uniform registry (index §1's shared-name rows — declare ONE name each) | ✅ **DONE** — step-1.3–1.5 commit |
| 1.4 | Single `vSubstellarAngle` varying, computed once (consumers: Bands, Clouds, Cryo, Optical) | ✅ **DONE** — step-1.3–1.5 commit |
| 1.5 | §3 pipeline-order skeleton in the mega-shader | ✅ **DONE** — step-1.3–1.5 commit |

**→ Step 1 (shared-libs foundation) COMPLETE.** The contract the 8 domains build
against is locked. Next: **step 2** (generation-side surfacings, index §2) then
**step 3** (Relief — lands the shared Voronoi consumer + canyonHeight writer).

### 1.1 — voronoi3d keystone (DONE, `262f63a`)

The shared 3D cellular primitive three domains route through (relief craters F2, cryo pits/polygons, exotic hex/crystal/shatter). Built ONCE per index §1 — **do not fork parallel primitives.**

- **CPU oracle** `planet-lod-lab-core.js` → `voronoi3d(p, cells)` returns `{f1, f2, cellId, toCenter, grad}`. `grad = ∂F1/∂p = normalize(p − center)` — the relief-normal contribution.
- **GLSL** `planet-lod-lab.html` → `voronoi3d(vec3 p, int cells, out vec3 cellId, out vec3 grad)` + `hash33` (transcribed from the oracle, same hash constants). Behind a temporary `▸ Debug — voronoi3d spike` lil-gui folder (modes: F1 / F2−F1 borders / cell-id color / lit relief).
- **Tests** `tests/planet-lod-voronoi.test.js` — 8, TDD'd (RED→GREEN). Analytic gradient pinned vs central finite-difference (the relief-doc §5.4 silent-bug guard); F2≥F1; determinism; the 27-vs-9 cost/quality invariant.
- **Live-verified on `:9223`** (screenshots `voronoi-spike-01..06`): **27-cell is seam-free at the pole, across all meridians, with correct analytic-normal lighting and a clean F2−F1 border network.** 3D-domain (sampled on `vPos`) is seam-free by construction — the reason to pay for 27 cells. Debug OFF → Stage-A render unchanged (no regression).

**→ Risk #1 (index §5, the single highest-priority spike) is CLEARED on cycle 1.** It gated every cellular feature; cellular work is now unblocked.

### 1.2 — emissiveBlackbody (DONE, `304f998`)
Shared incandescence color ramp (index §1) — ONE curve, two consumers: Bands
thermal (F32/F33), Exotic magma (F41). Returns **chromaticity only** (peak ≈1);
caller scales brightness (`uThermalStrength × starFacing`). Stylized
Planckian-locus ramp anchored to real blackbody sRGB (deep-red → orange → amber →
warm-white), NOT a spectral integration — posterize-bypass term, so hue-smoothness
not quantization is the point. CPU mirror in `planet-lod-lab-core.js` (chained
smoothstep-mix over 5 stops) + 9 TDD tests (`tests/planet-lod-blackbody.test.js`,
RED→GREEN); GLSL transcription beside the voronoi3d lib (same stops/weights).
Live-verified on `:9223` via temporary **debug mode 5** (pole-to-pole swatch).

### 1.3 / 1.4 / 1.5 — shared-libs contract (DONE)
- **1.3 registry** — full contract in `research/stage-c/REGISTRY-canonical-uniforms.md`
  (canonical name · kind · owner · consumers · status per index §1 row). The 4
  cross-domain semantic uniforms (`uLiquidStability`, `uLiquidMask`,
  `uLiquidSpecies`, `uCryoActivity`) are **RESERVED** in the central `uniforms`
  object at default-off — owner domain wires derivation (step 2) + GLSL read
  (step 3+). `latBias` + storm arrays = **DEFERRED** (per-domain; owner declares).
- **1.4 vSubstellarAngle** — vertex **varying**, computed ONCE
  (`acos(clamp(dot(normalize(pos), normalize(uLightDir)),-1,1))`), object-space.
  Consumers: Bands/Clouds/Cryo/Optical. Live-verified via **debug mode 6**
  (bright sub-star spot → dark antistellar).
- **1.5 pipeline-order skeleton** — `main()` restructured to the index §3 fixed
  compositing order as labeled **Stage 1–9** placeholders + the `canyonHeight`
  accumulator (declared in stage 1; Relief writes, Fluvial/Cryo add in) + the
  **★ emissive-after-posterize** channel block. Existing terms preserved exactly
  (commutative final sum) — no-regression verified on the Rocky render.

### Carry-forward (still open)
- The `▸ Debug — voronoi3d spike` folder (now modes 1–6: voronoi + blackbody +
  substellar) is a **temporary harness tool** — remove or fold into a permanent
  debug panel once the domains land; it's not a planet feature.
- `voronoi3d`'s `cells` param is the `qualityTier` 27↔9 knob's GPU side. Wire it
  to `uVoroCells`/`craterCells` from `deriveUniforms` when craters land (step 3, Relief).
- The 4 RESERVED uniforms go **LIVE** when their owner wires the step-2 generation
  derivation + a consumer reads them — update the registry doc's Status column then.

---

## Open Max-decisions surfaced during Stage C (don't invent answers)

Index §4 carries the original 7. Added during implementation:

- **A. Mobile cellular path (NEW, from the 1.1 spike).** The 9-cell mobile fallback, done as a simple center-slab search, is **lossy/anisotropic** — cells stretch along the dropped axis (screenshot `voronoi-spike-05`); no hard seam, but not crater-quality. Per the index §5 fallback ladder (`27-cell → drop mobile cellular → albedo-only facets`), this points toward **drop mobile cellular → smooth relief** (spec already lists mobile as untuned-for-now) rather than shipping the stretched cells. Desktop-primary 27-cell is clean. **Not a blocker** — surfaced for when Max tunes the mobile tier. A better reduced search (pruned neighborhood) could be revisited if mobile cellular is later wanted.

---

## Step 2 — generation-side surfacings (index §2) — IN PROGRESS
All derived in `deriveUniforms` (`planet-lod-lab-core.js`), TDD'd in
`tests/planet-lod-generation.test.js`, presets carry the mirrored generator fields.

| # | Field | Status |
|---|---|---|
| 1 | `surfaceGravity` (g = M/R²) | ✅ **DONE** — `be276e2` (4 tests) |
| 2 | planet-level `tidalHeat` (Io-normalized self-heating) | ✅ **DONE** — `435f536` (5 tests) |
| 3 | `liquidStability` + `liquidSpecies` (→ LIVE `uLiquidStability`/`uLiquidSpecies`) | ✅ **DONE** — D6+D2+D1 AND-gate; 8 TDD tests; promoted `liquidWater` proto; "Titan" preset added; registry RESERVED→LIVE. Live-verified `:9223` (Rocky 0.74/water, Ocean/Titan 1.0 — Titan species=1, Lava/Frozen 0; uniforms mirror `_derived`; console clean). |
| 4 | `volatileSpecies` classifier (N₂/CO₂/CH₄/H₂O) | ✅ **DONE** — JS selector (enum 0=none/1=H₂O/2=CO₂/3=CH₄/4=N₂) from volatileFraction + T_eq bands; 8 TDD tests; `_derived`-only (Cryo declares the uniform in step 3). Live-verified `:9223` (Titan 94K→CO₂, Frozen 60K→CH₄, warm/dry→none). |
| 5 | `precipitation` (D4) | ✅ **DONE** — `liquidStability` × rain-cycle composition factor (n2-o2 1.0/co2-n2 0.5/co2 0.2/h2-he·none 0); 7 TDD tests; `_derived`-only (Fluvial F11 reads in step 3). Presets carry atmosphere `composition`. Live-verified `:9223` (Rocky 0.74, Ocean/Titan 1.0 — Titan = methane rain, Lava/Frozen 0). |
| 6 | `atmosphere.physics.pressure` → shader | ✅ **DONE** — pure passthrough of the bundle's atmosphere pressure; 4 TDD tests; `_derived`-only (Aeolian F15 reads in step 3). Live-verified `:9223` (Rocky 1.0 / Ocean·Titan 1.5 / Lava·Frozen 0 — mirrors preset values). |
| 7 | `magneticField` (D13) | ⛔ **BLOCKED on Max-decision Q6** (surfacing ownership) — surface before building |

## Step 2 is COMPLETE except #7 (`magneticField`, BLOCKED on Max-Q6).
#1–#6 all done + live-verified. `deriveUniforms` now surfaces, beyond the Stage-A
set: `surfaceGravity`, `tidalHeat`, `liquidStability`+`liquidSpecies` (LIVE uniforms),
`volatileSpecies`, `precipitation`, `pressure`. Presets carry the mirrored generator
fields (mass/radius, orbit, `volatileFraction`, atmosphere `retained`/`pressure`/
`composition`). 71 lab tests green.

## Next session picks up at: **Surface Max-Q6, then Step 3 = Relief**
**Q6 (`magneticField` surfacing ownership — Optical vs separate workstream)** gates
step-2 #7 and Optical's aurora F37; it's inline-computed twice today
(`PhysicsEngine.js:168`, `PlanetGenerator.js:440`) and also drives atmosphere
stripping. **Surface it to Max before building #7 — don't invent the answer.**
Then **step 3 = Relief** (widest gap; lands the shared Voronoi consumer + writes
`canyonHeight`). After Relief, domains
fan out in parallel (worktree-isolated), each from its
`research/stage-b/RESEARCH_stage-b-<domain>-*.md` doc against this locked contract.
Index §7 is the dependency-ordered sequence.
