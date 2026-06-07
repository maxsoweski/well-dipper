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
| 7 | `magneticField` (D13) | ✅ **DONE** — Q6 RESOLVED (Max 2026-06-06: generation derives, Optical reads). `iron × lock-factor`, mirrors `PhysicsEngine.js:168` fieldStrength; `auroraIntensity` refactored to `magneticField × hasAtmo` (can't drift). 5 TDD tests. Live-verified `:9223` (Rocky 0.32, Lava 0.14 locked/aurora 0 airless, Ocean 0.28, Titan 0.18, Frozen 0.2/aurora 0). |

## Step 2 is COMPLETE — all 7 surfacings done + live-verified.
`deriveUniforms` now surfaces, beyond the Stage-A set: `surfaceGravity`, `tidalHeat`,
`liquidStability`+`liquidSpecies` (LIVE uniforms), `volatileSpecies`, `precipitation`,
`pressure`, `magneticField`. Presets carry the mirrored generator fields (mass/radius,
orbit, `volatileFraction`, atmosphere `retained`/`pressure`/`composition`). **76 lab
tests green.** Max-Q6 resolved 2026-06-06 (generation derives magneticField, Optical reads).

## Step 3 — Relief (index §7.3) — IN PROGRESS
The widest gap and the first VISIBLE domain. Lands the shared `voronoi3d` consumer
(craters F2) + writes the `canyonHeight` accumulator (tectonic graben); reads
`surfaceGravity` (crater simple→complex F2, edifice height F7) + `tidalHeat` (F8 lava).
Built feature-by-feature, each TDD'd + live-verified on `:9223` per the proven step-2 pattern.

| F# | Feature | Status |
|---|---|---|
| F2 | **Craters** (voronoi3d consumer + `surfaceGravity` reader) | ✅ **DONE** — first cellular feature live; see below |
| F1 | **Mountains / ranges** (ridged multifractal, orogeny belts) | ✅ **DONE** — ridged base relief live; see below |
| F4 | **Canyons / rifts** (tectonic graben — **writes `canyonHeight`**) | ✅ **DONE** — first `canyonHeight` writer live; see below |
| F5 | **Scarps & fault systems** (warped fault-block province) | ✅ **DONE** — warped soft-step cliffs live; see below |
| F6 | **Plateaus / highlands / tessera** | ✅ **DONE** — HeteroTerrain + mesa terrace + crosscutting tessera lattice live; see below |
| F3 | **Ejecta & rays** (reuses F2 Voronoi centers) | ✅ **DONE** — apron + rampart + bright rays live; see below |
| F7 | **Volcanic edifices** (reads `surfaceGravity`, `tidalHeat`) | ✅ **DONE** — shield/strato cones + summit caldera live; see below |
| F8 | Lava plains & flows (emissive cracks, reads `tidalHeat`) | ✅ **DONE** — flood-basalt plains suppress relief + animated emissive cracks live; see below |
| F9/F10 | Chaos + ridged-icy (reads SHARED `uCryoActivity` from Cryo) | ◻ (cross-domain seam — **last single-domain relief work; see F8 note re: uCryoActivity**) |

### F2 — Craters (DONE)
First consumer of the `voronoi3d` keystone + first reader of `surfaceGravity`.
- **CPU oracle** `craterProfile(r, {morphology, relaxation, terraceCount})` in
  `planet-lod-lab-core.js` → `{h, dhdr}` — parabolic cavity + gaussian rim +
  morphology-gated central peak + terrace rings, relaxation-flattened. Analytic
  `dhdr` pinned vs central finite-diff (relief-doc §5.4 silent-bug gate).
- **deriveUniforms** surfaces `craterDensity` (= `bombardment × (1−resurfacing)`,
  surface age), `craterComplexD` (= `k/g`, the simple→complex transition ∝ g⁻¹,
  `k` icy-switched), `craterRelaxation` (icy×warmth palimpsest), `terraceCount`.
- **GLSL** `craterProfile()` + `craterCombiner()` (transcribed; consumes
  `voronoi3d`, per-cell hash host-gate + radius, `morphology = smoothstep` on the
  g⁻¹ transition — NO type branch), wired into Stage-2 of the mega-shader.
  `uCraterDensity≤0` early-outs → Stage-A base untouched (regression-verified).
- **16 TDD tests** (`tests/planet-lod-relief.test.js`); **92 lab tests green**.
- **Live-verified `:9223`** (screenshots): Frozen (density 0.81, low-g → saturated
  simple bowls, Moon-like) ✓; Lava (0.015, Io-resurfaced → crater-free) ✓; forced
  complex (low complexD → central peaks + concentric terrace rings) ✓; `density=0`
  → bare Stage-A base restored ✓; console clean (pre-existing favicon-404 only).
- **Carry-forward / Max-decisions surfaced (relief-doc §6, taste — none block work):**
  built the felt range (simple bowl + complex central-peak/terraces + palimpsest);
  **peak-ring / multi-ring basin morphology deferred** (rarest visually, additive to
  add later — relief-doc §6 Q2). LOD2 posterize-level for cratered bodies stays at 6
  (Q1, the §4 tracked-open envelope decision).

### F1 — Mountains / ranges (DONE)
The ridged-multifractal BASE relief the other relief features layer on. No type
branch — isotropic ridged hills ↔ anisotropic fold belts is a continuous blend.
- **CPU oracle** `ridgedFold(value, grad, offset)` in `planet-lod-lab-core.js` →
  `{value, grad}`: the per-octave fold `signal = offset − |value|`, sharpened
  (`signal²`), with the **Decarpentier −sign(value) correction chain-ruled through
  the square** (`2·signal·−sign·grad`). This is the relief-doc §5.4 / §5-risk-#4
  silent-bug class (a dropped sign lights inverted ridge faces backward yet compiles
  fine) — pinned against finite-diff across BOTH sign branches in tests. The
  multifractal octave weighting is a locally-constant gain (Musgrave), not
  differentiated, so the per-octave fold is the exactly-differentiable tested unit.
- **deriveUniforms** surfaces `mountainAmp` (= `mix(0.25,0.6,1−erosion)`, eroded
  worlds → rounded low ranges), `orogenyStrength` (= `habitability×(1−erosion)`, the
  subduction proxy × young-age window — isotropic-ridged ↔ fold-belt blend), and
  `orogenyAxis` (a seed-hashed unit-vec2 strike direction).
- **GLSL** `fbmdRidged()` (ridged multifractal: fold + sharpen + `clamp(sq·gain,0,1)`
  next-octave weighting → connected crestlines; **the SAME trailing-octave + fwidth
  fade as `fbmd()`** — mandatory, the `abs()` fold aliases violently without it,
  relief-doc §5.3 risk #3) + `mountainCombiner()` (early-out `uMountainAmp≤0` →
  Stage-A base untouched). Anisotropic orogeny stretch = a symmetric linear map on
  the xz-plane (the gradient transforms back by the same map, Sᵀ=S). Wired into
  Stage-2 ahead of `craterCombiner`; new `▸ Mountains (F1)` lil-gui sub-folder.
- **13 TDD tests** added to `tests/planet-lod-relief.test.js`; **105 lab tests green**
  (`npx vitest run tests/planet-lod-*.test.js`).
- **Live-verified `:9223`** (screenshots): isotropic ridged → coherent rugged
  highland terrain (ridge/valley shadow structure at the terminator) ✓; orogeny=1 →
  anisotropic elongated fold belts vs the isotropic blobs ✓; `uMountainAmp=0` → pure
  Stage-A + F2 crater render restored (no regression) ✓; Frozen (amp 0.565 + density
  0.81) → Moon-like cratered ridged highlands, mountains+craters compose correctly ✓;
  console clean (favicon-404 only).
- **Cycle-1 fix logged (think-before-acting):** first render was high-freq speckle —
  root cause was the missing fwidth/trailing-octave fade in `fbmdRidged` (transcribed
  from `fbmd` WITHOUT it). Adding the fade (relief-doc §5.3) resolved it in one cycle;
  no parameter-thrashing.
- **No new cross-domain shared uniform** — `mountainAmp`/`orogenyStrength`/
  `orogenyAxis` are Relief-internal, so REGISTRY-canonical-uniforms.md is unchanged.
- **Carry-forward (relief-doc, not blocking):** slope-damped erosion (`iqTurbulence`,
  relief-doc §F1.a "free realism") DEFERRED — it's additive and complicates the
  gradient; add as a `▸ Mountains` toggle later. Orogeny (P3 true fold belts) is
  Max-open-question §6.3 (build fully or let generic ridged cover terrestrial); the
  continuous-blend machinery is in place either way.

### F4 — Canyons / rifts (DONE)
The tectonic-graben variant + the **first writer of the shared `canyonHeight`
accumulator** (registry §1 — Fluvial incised gorges + Cryo chasma ADD IN at
stages 3/4). A rift is the intersection of the sphere with a plane through the
centre (a great circle); combine 1–3 for a rift system.
- **CPU oracle** `grabenProfile(d, halfWidth, floorFrac)` in `planet-lod-lab-core.js`
  → `{depth, dddd}` — the trench cross-section vs perpendicular distance `d` to the
  rift line: `depth = smoothstep(floorHalf, halfWidth, d) − 1` (∈ [−1,0], **flat
  floor** at −1, smooth walls rising to 0 at the wall top, untouched outside). `dddd`
  = the wall SLOPE (`d/dd` of the smoothstep) — pinned vs central finite-diff (relief-
  doc §5.4 silent-bug gate, like `craterProfile`/`ridgedFold`; a sign-wrong wall lights
  the trench inside-out yet compiles fine). Flat-floor → zero-slope tested explicitly.
- **deriveUniforms** surfaces `chasmaDepth` (= `tectonicActivity × (1−0.4·erosion) ×
  0.28`, where `tectonicActivity = clamp01(max(resurfacing, habitability·0.7) +
  tidalProxy·0.5)` — the resurfacing / plate-tectonics-subduction / tidal-stress
  proxy, eroded-down), `chasmaCount` (1..3, seeded), `chasmaAxes` (3× seeded unit-vec3
  rift-plane normals via `seededUnitVec3`).
- **GLSL** `grabenProfile()` + `canyonCombiner()` (transcribed; per rift `s = dot(pos,n)`
  on the unit sphere → `d = |s|` with a **constant gradient** `ds/dpos = n`, so the wall
  slope chain-rules in as `gp.y·sign(s)·n` — no domain-warp Jacobian needed). **Writes
  `canyonHeight` += dep** (the shared accumulator) AND `h` AND `grad`. `uChasmaDepth≤0`
  early-outs → Stage-A base + F1/F2 untouched. Wired into Stage-2 after `craterCombiner`;
  new `▸ Canyons (F4)` lil-gui sub-folder (depth/count driven, width/floor lab knobs).
- **14 TDD tests** added to `tests/planet-lod-relief.test.js`; **119 lab tests green**
  (`npx vitest run tests/planet-lod-*.test.js`).
- **Live-verified `:9223`** (screenshots): 3 rifts isolated (mountains/craters zeroed) →
  great-circle trenches carve across with correctly-lit V-walls ✓; single rift at the
  terminator → clean flat-floored trench, lit wall + shadowed floor ✓; `uChasmaDepth=0`
  → rift vanishes, FBM base restored (no regression) ✓; Lava preset (real bundle →
  derives `chasmaDepth=0.28` from Io-grade tidal + full resurfacing) → rift composes
  with F1 ridged mountains + F2 (resurfaced, near-zero density) + emissive ✓; console
  clean (favicon-404 only).
- **Cross-domain:** `canyonHeight` registry row updated — Relief now WRITES the tectonic
  term (was "declared, awaiting writer"). Fluvial/Cryo add into it when they land.
- **Carry-forward (relief-doc §F4, not blocking):** (1) the **inverted Voronoi-border
  graben web** (IQ edge-distance pass-2) — the networked-fault rich tier — DEFERRED; it
  needs the perpendicular-edge-distance second pass added to `voronoi3d` (currently
  returns f1/f2 only, not `dot(0.5(mr+r), normalize(r−mr))`), and §F4d lists the linear
  chasma alone as the cheap-tier deliverable. (2) **Wall strata** (`floor(h·N)/N` exposed
  layers) DEFERRED — additive height-banding, add as a `▸ Canyons` toggle later. (3)
  Rifts are full great circles (not segment-gated) — a positional gate along the rift is
  a later refinement. The clean directional graben (the felt core) ships now; the web +
  strata layer on additively, mirroring F1 (deferred slope-erosion) / F2 (deferred
  peak-ring basins).

### F5 — Scarps / fault systems (DONE)
The warped fault-block province — lobate contraction scarps / horst-and-graben. A
scarp is a ONE-SIDED cliff: a soft step across an iso-contour of a smooth field. I
took the **warped-FBM iso-contour** path (research §F5.a / §F5.d cheap-tier), NOT the
inverted-Voronoi-border path — so F5 needs NO `voronoi3d` edge-distance pass-2 (still
deferred), exactly as F4 shipped the linear chasma and deferred the Voronoi web.
- **CPU oracle** `scarpProfile(field, level, halfWidth)` in `planet-lod-lab-core.js`
  → `{height, dhdf}`: `height = smoothstep(level−width, level+width, field)` ∈ [0,1]
  (flat low block → soft cliff face → flat high block). `dhdf` = the cliff-face slope
  the combiner chain-rules into the shading gradient; pinned vs central finite-diff
  (relief-doc §5.4 silent-bug gate — a sign-wrong cliff lights the scarp backward yet
  compiles). The finite-diff sweep stays strictly INSIDE the band (|f|<width); the
  flat-block zero-slope is pinned by the shape-invariants test (sampling exactly on
  ±width straddles the derivative discontinuity).
- **deriveUniforms** surfaces `scarpStrength` (= `clamp01(smallness × (1−0.5·erosion))
  × 0.12`, where `smallness = clamp01((1.3−radiusEarth)/1.0)` — SMALLER bodies cool/
  contract more, the Mercury/Moon lobate-scarp driver D11/D16, a DISTINCT axis from F4's
  tidal/plate stress; eroded-down; never fully zeroes a big world so Earth keeps faint
  wrinkle ridges), `scarpStyle` (= `smoothstep(0.1,0.3,volatileFraction)` — rock→THRUST
  0 ↔ ice→NORMAL 1, D2), `scarpAxis` (seeded unit-vec3 via `seededUnitVec3(seed+7)`,
  the scarp-front orientation — fronts are iso-contours ⊥ this axis).
- **GLSL** `scarpProfile()` + `scarpCombiner()` (transcribed). The field is a directional
  `dot(pos, axis)` made sinuous by a single `noised()` warp; a periodic `sin`-train of
  soft-steps raises/drops alternating fault blocks (each block edge = a one-sided cliff).
  The field gradient is **EXACT** (`axis + warp·warpFreq·noiseGrad` — no domain-warp
  Jacobian, unlike F1's orogeny stretch), so cliff faces light correctly via
  `amp·sp.dhdf·cos(phase)·freq·dfield`. `uScarpStyle` flips polarity (thrust up ↔ normal
  down); contribution centered on datum (`sp.x − 0.5`). `uScarpStrength≤0` early-outs
  (Stage-A base + F1/F2/F4 untouched). Wired Stage-2 after `canyonCombiner`; new
  `▸ Scarps (F5)` lil-gui sub-folder (strength/style driven via `.listen()`,
  width/freq/warp/warpFreq lab knobs). Axis copied to `uScarpAxis` in `applyDrivers`.
- **15 TDD tests** added to `tests/planet-lod-relief.test.js`; **134 lab tests green**
  (`npx vitest run tests/planet-lod-*.test.js`).
- **Live-verified `:9223`** (screenshots `f5-01..04`): isolated thrust scarps (mountains/
  craters/rifts zeroed) → diagonal parallel fault-block bands across the surface ✓;
  scarps off (`uScarpStrength=0`) → bands vanish, FBM base restored (no regression) ✓;
  normal style (style=1) → lit/shadow polarity flips (lit ridges ↔ dark grabens) ✓;
  Frozen preset (real bundle → derives `scarpStrength=0.0912`, `scarpStyle=1` icy-normal)
  → subtle scarp texture composes with saturated craters + ridged mountains, Moon-like ✓;
  console clean (vite + benign lil-gui form-field issue only).
- **No new cross-domain shared uniform** — `scarpStrength`/`scarpStyle`/`scarpAxis` are
  Relief-internal, so REGISTRY-canonical-uniforms.md is unchanged.
- **Carry-forward (relief-doc §F5, not blocking, mirrors F1/F2/F4 deferrals):** (1) the
  **inverted Voronoi-border scarp** (the rich networked-fault tier) DEFERRED — it shares
  the `voronoi3d` edge-distance pass-2 with F4's graben web and F6; add that pass-2 once,
  for all three. (2) **Asymmetric one-sided profile** (thrust = steep front + gentle back,
  vs the current symmetric ±-polarity blocks) DEFERRED — a rich-tier refinement. (3)
  **Wrinkle ridges** (narrow asymmetric ridges on lava plains, cross-ref F8) DEFERRED to
  when F8 lands. The warped fault-block province (the felt core) ships now. **Watch:** the
  scarp uses a single-octave field + `sin`-train (not a multi-octave abs-fold), so the
  §5.3 fwidth/trailing-octave fade rule doesn't apply; at very high `uScarpFreq` the train
  could shimmer — kept modest (default 6) and verified clean; add an fwidth amplitude fade
  if a future preset pushes freq high.

### F6 — Plateaus / highlands / tessera (DONE)
Flat-topped highlands via **Musgrave HeteroTerrain + a mesa height-terrace** (the plateau
core), PLUS the **crosscutting tessera lattice** (the rarer Venus Ovda-Regio variant). The
plateau core landed first (`42605e0`); the tessera combiner followed this session. Tessera
took the **cheap warped-iso-contour ridge path** (research §F6.a / §F6.d), NOT the rich
inverted-Voronoi-border path — so F6 needs NO `voronoi3d` edge-distance pass-2 (still
deferred, shared with F4-web/F5-rich), exactly as F4/F5 shipped their cheap tiers.
- **CPU oracle** `terraceProfile(h, levels, softness)` in `planet-lod-lab-core.js` →
  `{value, dvdh}`: quantizes a height into `levels` flat treads separated by SOFT risers
  (`smoothstep`) so the gradient exists (a hard `floor(h·N)/N` has none). `value` is
  CONTINUOUS at every band boundary (tread of band k+1 = top of band k) — only `dvdh` is
  kinked (tread↔riser); pinned vs central finite-diff INSIDE a riser (relief-doc §5.4 gate),
  flat-tread zero-slope tested separately. HeteroTerrain itself is GLSL-only (it reweights
  the already-finite-diff-tested `noised()` octave — same status as `fbmd`/`fbmdRidged`).
- **deriveUniforms** surfaces `plateauStrength` (= `clamp01(tectonicActivity ×
  (1−0.4·erosion)) × 0.2` — crustal thickening grows highlands, eroded-down; reuses the F4
  `tectonicActivity` proxy), `tesseraStrength` (= `clamp01(smoothstep(0.45,0.9,
  tectonicActivity) × (1−0.4·erosion)) × 0.15` — a HIGH gate so only Venus/Io-grade worlds
  show the lattice; tessera combiner deferred, but the field is live + tested),
  `tesseraAxes` (2× seeded unit-vec3 lattice orientations via `seededUnitVec3(seed+8/+9)`).
- **GLSL** `fbmdHetero()` (HeteroTerrain: per-octave contribution weighted by the running
  height `clamp(value,0,1)` → high areas rough, low areas smooth/flat-floored; weight
  locally-constant per octave like `fbmdRidged`'s, so the gradient is the standard fbmd
  chain rule scaled by the weight; carries fbmd's trailing-octave + fwidth fade) +
  `terraceProfile()` + `plateauCombiner()` (terraces the hetero height → mesa steps; chain
  rule `dv/dh · ph.grad · uPlateauScale`). **Octaves CAPPED at 3** in the combiner — the
  cycle-1 fix: terracing a FULL multi-octave height chops fine detail into band-crossing
  noise instead of broad mesas; plateaus are large features that don't gain fine roughness
  at high LOD. `uPlateauStrength≤0` early-outs (Stage-A base + F1/F2/F4/F5 untouched). Wired
  Stage-2 after `scarpCombiner`; new `▸ Plateaus (F6)` lil-gui folder (strength driven via
  `.listen()`; scale/offset/levels/softness lab knobs).
- **15 TDD tests** added to `tests/planet-lod-relief.test.js`; **149 lab tests green**
  (`npx vitest run tests/planet-lod-*.test.js`).
- **Live-verified `:9223`** (screenshots `f6-01..04`): isolated plateau → broad flat-floored
  lowlands vs rough-margined highlands (HeteroTerrain stratification) ✓; terrace cranked
  (levels 7, sharp risers) → distinct stacked mesa-step contours, confirming the terrace
  mechanism ✓; plateau off (`uPlateauStrength=0`) → bare FBM base restored (no regression) ✓;
  Rocky preset (real bundle → derives `plateauStrength=0.0825`, `tesseraStrength=0.0029`
  near-zero) → subtle broad plateau composes with complex craters + ridged mountains +
  scarps + rift, full Earthlike stack, no blowout ✓; console clean (vite + benign lil-gui
  form-field issue only).
- **Cycle-1 fix logged (think-before-acting):** first render was uniform speckle — root
  cause was terracing the full multi-octave hetero height (fine detail crossed terrace
  bands everywhere → noise). Capping the plateau base to 3 octaves (broad field) resolved
  it in one cycle; no parameter-thrashing.
- **No new cross-domain shared uniform** — `plateauStrength`/`tesseraStrength`/`tesseraAxes`
  are Relief-internal, so REGISTRY-canonical-uniforms.md is unchanged.
#### F6 tessera combiner (DONE — this session)
The crosscutting ridge-and-groove lattice (the §F6.a cheap tier). EXOTIC coordination
resolved: EXOTIC owns the geometric P15 lattice (hex/crystal/shatter via the shared
`voronoi3d` primitive); the cheap warped-ridge path here is unambiguously Relief's own
expression, touches no shared Voronoi pass-2, and EXOTIC hasn't landed (domains fan out
after Relief).
- **CPU oracle** `ridgeWave(phase)` in `planet-lod-lab-core.js` → `{value, dvdphase}`:
  the per-axis ridge fold `value = 1 − |sin(phase)|` (crests at `phase=nπ`, grooves at
  `π/2+nπ`), `dvdphase = −sign(sin)·cos(phase)`. The `−sign(sin)` correction across the
  `|.|` fold is the SAME §5.4 silent-bug class as `ridgedFold` (drop it → groove walls
  light backward yet it compiles); pinned vs central finite-diff INSIDE smooth half-periods
  (the kink at `phase=nπ` is avoided), with both sign branches exercised + a sign-drop
  regression guard. **6 TDD tests** added; **155 lab tests green**.
- **GLSL** `ridgeWave()` + `tesseraCombiner()` (transcribed). TWO warped-iso-contour ridge
  fields (reusing F5's exact warp: `dot(pos,axis) + warp·noised()`, EXACT field gradient
  `axis + warp·warpFreq·noiseGrad`) at the 2 seeded `tesseraAxes`, each carved as a
  `1−|sin|` ridge and **MULTIPLIED** → the product drops to 0 wherever EITHER field is in a
  groove, so grooves from both orientations show (the crosscutting lattice over a high
  crust). The two warps use different seeds (macro/detail offsets) to decorrelate the groove
  sets. Gradient = product rule across the two ridges (`rw1·dr0 + rw0·dr1`, each
  `dr = dvdphase·freq·dfield`). `−0.5` DC is cosmetic (normal-only shading). `uTesseraStrength≤0`
  early-outs (Stage-A base + F1/F2/F4/F5/plateau untouched). Wired Stage-2 after
  `plateauCombiner`; new `▸ Tessera (F6)` lil-gui folder (strength driven via `.listen()`;
  freq/warp/warpFreq lab knobs). Axes copied to `uTesseraAxis[2]` in `applyDrivers`.
- **Live-verified `:9223`** (screenshots `f6-tessera-01..04`): isolated tessera (other relief
  zeroed) → crosscutting woven grooves across the surface ✓; low-freq orthogonal crosshatch
  → unambiguous two-direction groove lattice ✓; `uTesseraStrength=0` → lattice vanishes, bare
  FBM base restored (early-out regression) ✓; full relief stack (mountains+craters+chasma+
  scarp+plateau+tessera at 0.05, near Ocean's derived 0.0408) → tessera composes as a fine
  crosscutting weave without blowout, craters stay readable ✓; console clean (vite + benign
  lil-gui form-field only). Generation gate confirmed live: Ocean derives 0.0408 (most active
  natural preset), Rocky 0.0029 near-zero, Titan/Frozen 0 — the high-stress gate works.
- **No new cross-domain shared uniform** — `uTesseraStrength`/`uTesseraAxis`/`uTesseraFreq`/
  `uTesseraWarp`/`uTesseraWarpFreq` are Relief-internal, so REGISTRY-canonical-uniforms.md is
  unchanged.

- **Carry-forward (relief-doc §F6, not blocking):** (1) **Rich Voronoi-border tessera**
  (the networked-fault rich tier, sharing the `voronoi3d` edge-distance pass-2 with F4-web/
  F5-rich) DEFERRED — add the pass-2 once, for all three; NB §F6.a notes EXOTIC may own the
  cleaner P15 lattice, so coordinate before building it. (2) **Rough margins as a separate
  high-octave term** (true HeteroTerrain "rough-margined highlands" with un-terraced fine
  detail riding the terraced base) DEFERRED — the capped-octave base reads as broad plateaus
  now; layering fine roughness on the margins is additive. (3) **Tessera shimmer watch:** the
  combiner is two single-octave `sin`-trains (like F5), so the §5.3 fwidth/trailing-octave
  fade doesn't apply; at very high `uTesseraFreq` the product could shimmer — kept modest
  (default 5) and verified clean; add an fwidth amplitude fade if a future preset pushes it.

### F3 — Ejecta & rays (DONE)
The apron that WRAPS the F2 craters — first relief feature to REUSE another feature's
voronoi3d placement (no new centers): same `pos*uCraterScale+uCraterOffset` sample, same
per-cell host gate + hashed radius, so the apron rings exactly the F2 craters. Three parts
per relief-doc §F3: continuous/discontinuous ejecta blanket + fluidized rampart (relief),
bright rays (the one ALBEDO exception). Secondary crater fields DEFERRED (rich tier).
- **CPU oracle** `ejectaProfile(r, rampart, rOuter)` in `planet-lod-lab-core.js` →
  `{h, dhdr}`: the radial apron OUTSIDE the rim (1<r<rOuter=2.5), blended by `rampart`:
  the dry **normalized 1/r² skirt** `(1/r²−1/rOuter²)/(1−1/rOuter²)` (=1 at the rim → 0 at
  rOuter) ↔ the fluidized **lobate terminal ridge** (gaussian bump at r=2.0; Mars ramparts,
  D2 ground-ice). Zero for r≤1 (F2 owns) and r≥rOuter. `dhdr` pinned vs central finite-diff
  for rampart=0/0.5/1 (relief-doc §5.4 silent-bug gate) + a sign-drop guard (dhdr<0 across
  the dry skirt — a flipped 1/r² sign lights the apron outward, backward).
- **deriveUniforms** surfaces (NO new driver — all from existing fields, relief-doc §F3.b):
  `ejectaStrength` (= `craterDensity` — apron tracks crater count; resurfaced → 0),
  `ejectaRampart` (= `smoothstep(0.15,0.4,volatileFraction)` — rocky dry ↔ icy rampart),
  `rayBrightness` (= `clamp01(1−erosion) × (hasAtmo ? 0 : 1)` — the AIRLESS-only × young gate;
  an atmosphere weathers rays away).
- **GLSL** `ejectaProfile()` + `ejectaCombiner()` (wraps the F2 voronoi; radial slope chain-
  ruled exactly via `voroGrad·uCraterScale`; FBM lumpiness × discontinuous-patch mask via
  `noised()` with its analytic grad — patch mask's r-deriv held locally-constant, the Musgrave
  convention this codebase already uses) + `rayField()` (the albedo term — radial streaks via
  a stable per-crater basis + azimuth, added to surface luminance BEFORE posterize per §F3.a;
  NOT relief, no height/grad). `uEjectaStrength≤0` early-outs (regression-safe); rays share the
  enable toggle. Wired Stage-2 after `craterCombiner`; new `▸ Ejecta & Rays (F3)` lil-gui folder.
- **15 TDD tests** (9 oracle + 6 surfacings) added to `tests/planet-lod-relief.test.js`;
  **170 lab tests green** (`npx vitest run tests/planet-lod-*.test.js`).
- **Live-verified `:9223`** (GPU Chrome): ejecta ON → lumpy apron wraps each crater, OFF →
  bare F2 rims restored (enable-gate regression) ✓; rampart=1 → raised lobate terminal ring
  encircling craters (vs the smooth decaying skirt) ✓; Frozen (airless) → bright radial ray
  streaks fan from craters, A/B-gated by rayBrightness (rays vanish at 0) ✓; airless-derivation
  gate confirmed live (Rocky w/ atmosphere → rayBrightness 0; Frozen airless → 0.9); full Rocky
  relief stack (mountains+craters+ejecta+chasma+scarp+plateau+tessera) composes without blowout,
  craters stay readable ✓; console clean (vite + benign lil-gui form-field only).
- **No new cross-domain shared uniform** — `uEjectaStrength`/`uEjectaRampart`/`uEjectaAmp`/
  `uEjectaLump`/`uRayBrightness`/`uRayCount`/`uRaySharp` are Relief-internal (placement reuses
  the F2 crater uniforms), so REGISTRY-canonical-uniforms.md is unchanged.
- **Carry-forward (relief-doc §F3, not blocking, mirrors F2/F4/F5/F6 deferrals):** (1) **Secondary
  crater fields** (small clustered craters downrange, via a secondary Voronoi seeded off each
  primary) DEFERRED — the rich-tier extra (§F3.d), purely additive. (2) **Ray cell-boundary
  truncation:** rays render within the host crater's Voronoi cell, but a real ray system overruns
  its cell — rays truncate at cell borders. The stylized within-cell streaks ship; full cross-cell
  rays are a later refinement. (3) **Max-taste decision (index §4.4) — bright rays keep-stylized
  vs drop:** built per the research "keep + stylize" rec (airless-gated, pre-posterize luminance
  add); they're striking on young airless worlds but only there. Surface for Max's call.

### F7 — Volcanic edifices (DONE)
First reader of `surfaceGravity` AND `tidalHeat` together (both surfaced in step 2), and
the first relief feature with its OWN sparse Voronoi placement (a NEW center set, not F2's
— `uEdificeScale` < `uCraterScale` → fewer, bigger cones). Cheap tier per relief-doc §F7.d:
shield/strato cones + summit caldera; corona/nova/arachnoid radial-fracture + pancake domes
DEFERRED (rich tier).
- **CPU oracle** `edificeProfile(r, shieldStratoMix, calderaR)` in `planet-lod-lab-core.js`
  → `{h, dhdr}`: cone body `pow(1−r, p)` with `p = mix(1.5, 4, shieldStratoMix)` (SHIELD
  broad-shallow ↔ STRATO steep-narrow), plus a summit **caldera** — a parabolic bowl
  (reuses the F2 inverted-bowl shape) subtracted at `r<calderaR`. Zero for `r≥1` (distant
  cells don't bleed). Analytic `dhdr` pinned vs central finite-diff for mix=0/0.5/1 on BOTH
  the flank and inside the caldera (relief-doc §5.4 silent-bug gate). **Cycle-1 fix
  (think-before-acting):** caldera depth 0.25 was too shallow to overcome the strato cone's
  ~0.40 drop across `calderaR` → the summit read as a peak, not a pit; bumped to 0.5 (clears
  every mix with margin). The shape-invariant test "summit depressed below the caldera rim"
  caught it before the shader.
- **deriveUniforms** surfaces `volcanismStrength` (= `clamp01(tidalProxy + resurfacing·0.5 +
  habitability·0.3)` — D12 tidal + D11 young resurfacing + a modest subduction-arc proxy;
  the edifice DENSITY gate), `edificeMaxHeight` (= `clamp(1/g, 0.2, 2.0)` — low-g worlds grow
  GIANT shields, the Olympus Mons / D14 driver), `shieldStratoMix` (= `clamp01(habitability)`
  — wet/habitable → viscous explosive STRATO ↔ dry/tidal → fluid effusive SHIELD).
- **GLSL** `edificeProfile()` + `edificeCombiner()` (transcribed; OWN sparse voronoi3d at
  `uEdificeScale`, per-cell hash host-gate by `uVolcanismStrength` + hashed radius
  `mix(0.3,0.7)` — bigger than craters; radial slope chain-ruled exactly via
  `voroGrad·uEdificeScale`; height scaled by `uEdificeAmp·uEdificeMaxHeight`).
  `uVolcanismStrength≤0` early-outs → Stage-A base + F1/F2/F3/F4/F5/F6 untouched. Wired
  Stage-2 after `tesseraCombiner`; new `▸ Edifices (F7)` lil-gui folder (volcanism/height/
  shield↔strato driven via `.listen()`; scale/amp/caldera lab knobs).
- **17 TDD tests** (10 oracle + 7 surfacings) added to `tests/planet-lod-relief.test.js`;
  **187 lab tests green** (`npx vitest run tests/planet-lod-*.test.js`).
- **Live-verified `:9223`** (GPU Chrome, screenshots `f7-01..05`): isolated shield cones
  (broad raised domes, other relief zeroed) ✓; ON/OFF A/B (`uVolcanismStrength=0` → cones
  vanish, bare FBM base restored = enable-gate regression-safe) ✓; the upper-left dome shows
  a darker summit spot = the caldera pit reading correctly ✓; full Rocky stack (complex
  craters + ridged mountains + modest stratovolcanoes at volc 0.26) composes without blowout,
  craters stay readable ✓; console clean (favicon-404 only). Generation gates confirmed live:
  **Lava** derives volc=1.0 / shield (mix=0, dry airless) / maxH=1.25 (low-g); **Rocky**
  volc=0.26 / strato (mix=0.7, wet) / maxH=1.11 — the tidal/resurfacing density gate, the
  g⁻¹ height scale, and the viscosity axis all read as designed.
- **No new cross-domain shared uniform** — `uVolcanismStrength`/`uEdificeMaxHeight`/
  `uShieldStratoMix`/`uEdificeScale`/`uEdificeAmp`/`uEdificeCaldera`/`uEdificeOffset` are
  Relief-internal (own placement), so REGISTRY-canonical-uniforms.md is unchanged.
- **Carry-forward (relief-doc §F7, not blocking, mirrors F2/F4/F5/F6 deferrals):** (1)
  **Pancake domes** (Venus, thick-air D5 — flat-topped steep-sided, pressure-gated; reuses
  the plateau-step primitive at small radius) DEFERRED — surface `uPancakeStrength` +
  pressure gate when built. (2) **Corona/nova/arachnoid** (Venus plume uplift — concentric
  + radial fracture, reuses F5 scarp grooves radially around a domed uplift; expensive
  Voronoi) DEFERRED to the rich tier. (3) **Emissive summit/active lava** routes through the
  emissive-bypass channel — lands with F8 (lava plains), not here. The shield/strato cones +
  caldera (the felt core) ship now; pancake + corona layer on additively.

### F8 — Lava plains & flows (DONE)
The first relief feature whose **headline is EMISSIVE, not relief** — and the first to
ROUTE through the ★ emissive-bypass channel rather than the height/grad path. Reads
`tidalHeat` (step-2 `tidalProxy`) for the glow gate. Cheap tier per relief-doc §F8.d:
flood-basalt plains (resurfacing-suppression) + wrinkle ridges + animated Worley
emissive cracks; leveed channels / sinuous rilles / collapsed tube-pit chains DEFERRED
(rich tier). TWO mechanisms in one feature:
- **(1) Flood-basalt plains (relief SUPPRESSION).** A low-freq `noised()` flow-region
  mask whose EXTENT grows with `uLavaCoverage` (Io-grade resurfacing → whole-world
  plains) **attenuates the accumulated relief** (`h,grad *= (1−region)`) toward a smooth
  plain — lava fills/flattens older terrain. `lavaCombiner` runs **LAST** in the combiner
  chain (after F7), so the suppression is a simple attenuation of the *accumulated* grad
  (normal-perturbation, not a re-differentiated height — the mask's own gradient is
  cosmetic, not chain-ruled). + **wrinkle ridges** (linear compression ridges, **the F5→F8
  deferral, now resolved**): a warped directional `dot(pos,axis)` field carved by the F6
  `ridgeWave` `1−|sin|` primitive — **reuses F6's ridgeWave + F5's warped-field pattern,
  both already §5.4-pinned, so NO new finite-diff oracle** (relief-doc §F8.a, and the
  handoff's note: the emissive crack mask has no dhdr to pin).
- **(2) Emissive cracks (THE HEADLINE).** A **Worley F2−F1 crack mask** `1 − smoothstep(0,
  uCrackWidth, F2−F1)` (the same `voronoi3d` keystone, sampled at `uCrackScale`), confined
  to the flooded regions, **animated** `0.5+0.5·sin(uTime·rate + fbm·TAU)`, in molten color
  from the shared `emissiveBlackbody(1400K)` ramp, scaled by `uLavaActivity` (D12 tidal:
  cold solidified plains vs glowing active lava). Returned by a `lavaCrackEmissive()` helper
  (NOT relief — no height/grad, like `rayField`) and **added AFTER the posterize ternary so
  it ALWAYS bypasses** the quantizer (the canonical Option-C survivor, §F8.c — crisp glow
  over posterized basalt). `uTime` already existed (clouds/aurora drive it) — no new clock.
- **deriveUniforms** surfaces `lavaCoverage` (= `clamp01(resurfacing)` — D11; SMOOTHS
  relief, consistent with F2's `craterDensity = bombardment×(1−resurfacing)`), `lavaActivity`
  (= `tidalProxy` — D12 emissive gate), `channelDensity` (= `clamp01(activity × seedHash)` —
  **_derived-only**, the deferred channel combiner's gate, surfaced for contract
  completeness like precipitation/pressure were), `lavaAxis` (seeded unit-vec3, wrinkle
  strike). **Emissive double-count resolved:** the flat `emissive` dropped from `hot` to
  `hot·0.25` (a faint thermal FLOOR) — the lava glow is now SPATIAL via the cracks, exactly
  as the handoff predicted ("F8 modulates the flat emissive"). Only the Lava preset has
  nonzero `hot` (T_eq 950), so no other preset is affected.
- **GLSL** `lavaCombiner()` + `lavaCrackEmissive()` (+ 11 new uniforms, a `▸ Lava plains
  (F8)` lil-gui folder, enable toggle gating BOTH early-outs, 🎲 offset). `uLavaCoverage≤0`
  ⇒ plains early-out; `uLavaActivity≤0 || uLavaCoverage≤0` ⇒ cracks dark.
- **6 TDD surfacing tests** (`tests/planet-lod-relief.test.js`) + **1 updated foundation
  test** (`hot body emits` threshold `>0.5`→`>0`, reflecting the now-spatial glow — intent
  preserved: hot emits, cool doesn't). **193 lab tests green** (`npx vitest run
  tests/planet-lod-*.test.js`). Backtick parity even (30). The emissive crack mask + plains
  suppression have NO CPU gradient to pin (relief-doc §F8.a) — verified VISUALLY, the
  surfacing LOGIC is unit-tested.
- **Live-verified `:9223`** (GPU Chrome, screenshots `f8-01..04`): Lava preset (derives
  coverage 0.95 / activity 1.0 / emissive 0.23 dimmed) → **molten crack veins glow on the
  night/terminator side** (Lambert-independent, the bypass working) over smooth wrinkled
  plains ✓; **enable OFF** (`uLavaCoverage/uLavaActivity=0`) → cracks vanish, rougher rocky
  relief restored, only the faint dimmed thermal floor remains (A/B regression-safe) ✓;
  **plains-suppression money shot** (Frozen's saturated craters + forced `lavaCoverage=0.7`)
  → smooth lava plains **flood and flatten** the cratered terrain across the disc while
  craters survive in the un-flooded highlands (the §F8.a resurfacing mask) ✓; console clean
  (favicon-404 only). Generation gates confirmed live: Lava → coverage 0.95/activity 1.0,
  Frozen/Titan → activity 0 (tidally dead).
- **No new cross-domain shared uniform** — all F8 uniforms (`uLavaCoverage`/`uLavaActivity`/
  `uLavaAxis`/`uLavaScale`/`uWrinkle*`/`uCrack*`/`uLavaGlowRate`) are Relief-internal, so
  REGISTRY-canonical-uniforms.md is unchanged. `channelDensity` is `_derived`-only (no GLSL
  consumer until the deferred channel combiner lands).
- **Carry-forward (relief-doc §F8, not blocking, mirrors F2–F7 deferrals):** (1) **Leveed
  channels / sinuous rilles / collapsed tube-pit chains** (rich tier §F8.a — directional
  carved channels with raised levees, meandering warped lines, periodic pit chains) DEFERRED;
  `channelDensity` is already surfaced as their gate. (2) **True per-region flow-lobe FBM**
  (the plains currently smooth + wrinkle; richer lobate flow fronts are additive). (3)
  **Quality-scalar cheap path** (§F8.d: drop the per-fragment Worley to a single flat emissive
  on mobile, or freeze `uTime`) — wire to `qualityTier` when the mobile tier is tuned.

⚠️ **F9/F10 are the LAST single-domain relief work and read SHARED `uCryoActivity`** (owned
by Cryo, which hasn't landed — RESERVED at default-off in the registry). Per the handoff:
they may ship with a stubbed/default `uCryoActivity` OR wait for Cryo. **Flag for Max** —
this is the decision point before the 8-domain fan-out.

After Relief, domains fan out in parallel (worktree-isolated), each from its
`research/stage-b/RESEARCH_stage-b-<domain>-*.md` doc against this locked contract.
Index §7 is the dependency-ordered sequence.
