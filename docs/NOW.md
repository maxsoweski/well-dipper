# Now — Well Dipper

**This file changes every session. It's the single screen that says where we are.**

For longer arc, see `JOURNEY.md`. For meta-purpose, see `HEART_OF_DESIRE.md`.

> **🧭 Orientation chain (active focus):** Well Dipper → SCREENSAVER heart → LOD-lab renderer
> (lab≠game, by design) → Phase 2 per-feature quality pass → **Theme A (wrong generation
> primitive) → #3 rivers ✅ SHIPPED (2026-06-19); F11 retired + dendritic made first-class
> (`076f586`) → **FLUVIAL FEATURE CO-DEPENDENCE — ✅ SHIPPED (Max UAT-passed 2026-06-19, "these seem
> to work together well"); 8 commits on master `167937d`, NOT yet pushed (awaiting Max push OK).**
> (Max's north star: features read each other's real output → distinct 3D landforms, not homogeneous
> mush). Spatially coupled F12 deltas (mouth/G channel), F13 outflow (order/B → real Strahler trunk),
> F20 coast (estuarine keying at mouths) onto the dendritic carve cube; routing now always-on per
> planet. 8-AC contract `docs/WORKSTREAMS/rivers-fluvial-coupling-2026-06-19/` (AC1–AC7 GREEN, AC8 UAT
> passed). Built via per-AC implement→audit→adjust workflows; a dual-call-site shader-compile bug was
> live-caught at AC4 + fixed.
> **▶ NEXT (Max's 2 next-steps, 2026-06-19):** (1) **RIVER SCALE** — "rivers still seem too large for
> the scale in question; the basic rendering tech here is sound but should be happening at smaller
> scales"; downstream features (deltas/outflow/coast) "seem more appropriate in scale" → it's the
> RIVERS' own width/scale that reads too large, NOT the coupling. Diagnose vs `rivers-viewdependent-lod-2026-06-18`
> (40k-mesh ~140km floor) and/or river width-tuning (shipped rivers AC6 width-by-radius + UAT-item1
> seeded width). (2) **GENERALIZE THE CO-DEPENDENCE APPROACH TO ALL TERRAIN GEN** — "use the info
> we've already built about which features interact/go together (D1-D16→P1-P28→F1-F53 model +
> planet-feature-associations.js) and make sure their systems are taking each other into account."
> Shipped predecessor: `docs/WORKSTREAMS/rivers-dendritic-drainage-2026-06-17/`.
> *(One-line breadcrumb so the nesting is reflexive across handoffs; update when the active feature changes.)*

> **🧭 The world-engine pipeline (write → read).** The world engine is a *story engine* (spine §0): **(1) inputs** — the galaxy engine (L0) hands down the per-body **D1–D16 driver vector** + system context; **(2) write the history** — the L1 engines run in **time's-arrow** tier/epoch order to derive the body's billions-of-years history ("derivation IS the history-writing work", spine §4c); **(3) read the history** — the L2 renderers only **express** those fields ("render expresses, procgen decides", spine §1). A body rendered out of causal/temporal order "reads" wrong. Full model: [`world-engine-architecture-spine.md`](FEATURES/world-engine-architecture-spine.md).

> **▶▶ ACTIVE (2026-07-03, world-engine program): ROADMAP v2.1 SIGNED OFF + V2-0 plumbing VERIFIED `0461463`.**
> **▶ ROADMAP v2.1 (condition-first re-founding) — ✅ SIGNED OFF by Max 2026-07-03** (`7cb10f1`; map of record:
> `WORKSTREAMS/world-engine-history-program-2026-06-27/ROADMAP-v2-condition-first.md`). Full §7a review: every
> recommendation adopted — V2-2 split approved (router+anchors, then stagnant response); wet-stagnant + corona-pierced
> = the falsification pair (Mars demoted to checkpoint); frozen pick-weights + lab override; no hysteresis; E1
> lab-only; reroute allow-list adopted; atmosphere restored as first-class sub-plan (V2-6 pointer row); SP-LID-DISRUPTION
> funded as cuttable V2-7d; THREE pre-code gates block V2-2 (L-form, localYield, interpenetration statistic). Same day:
> **#1 shell-relief + #4b Venus SHIPPED** (Max basis-level UATs — "first steps, crude, samey within a world, may be fine
> for this stage"; feedback routed V2-2/V2-7/V2-8/V2-7d).
> **▶ V2-0 (L0 plumbing + baseStep scalar extraction) — ✅ VERIFIED `0461463`, integration-complete (2026-07-03).**
> First increment under v2.1; ZERO-behavior-change refactor, no UAT gate (data-only by contract). Extracted
> `driver-presets.js` (17 presets + PRESET_ARCHETYPE) + `body-drivers.js` (neutral builder) + baseStep pure scalar
> helpers (`deriveBodyScalars` + bodyRawTidal/bodyShellThickness/…) + `body-condition-vector.js` threaded NESTED as
> `bodyDrivers.condition` (flat-age collision trap avoided). Evidence: 75/75 carrier goldens byte-identical through all
> slices (condition-bearing bundle vs condition-less goldens = inertness proof); baseStep ad156cc output-goldens exact;
> verify-workstream `wf_69271e5f-725` 5/5 unit ACs 3/3-adversarial; AC5 live-driven (6 presets, per-preset _fp values at
> the seam, fieldviz clean). ⚠ Lab gotcha: `setPreset` route completes ~500ms later — poll `_lastBodyDrivers` identity,
> 8-rAF waits race the rebuild. ⚠ 4 PRE-EXISTING failing tests in `src/generation` (KnownObjects ×3, GalacticFeatures ×1)
> — unrelated to world engine, verified identical at pre-change base; someone should triage eventually.
> **NEXT = the three pre-code research gates** (delegable #1 `L` form incl. the Mars-low-Φ fork, #2 `localYield(L,i)`,
> #3 interpenetration statistic over `primitiveId`) **→ scope V2-1 (E1 shadow mode)**. Atmosphere #3b gate OPEN
> (`~/briefings/handoff-world-engine-atmosphere-v2-pickup-2026-07-02.md`).
> (Prior ACTIVE block, superseded: #4b VERIFIED_PENDING_MAX — now SHIPPED per above.)
> **▶ #4b (Venus stagnant-lid relief writer) — ✅ VERIFIED_PENDING_MAX `0a95ed9`.** New three-free
> `src/worldengine/base/stagnantLid.js` (`writeStagnantLidReliefSphere`): ONE seeded mantle-plume field (BAT logic) →
> tessera crustal plateaus (percentile-thresholded ancient-plume caps + orthogonal fold/ribbon double-fabric) +
> coronae (field-biased; active dome+trench+rise / inactive rim+depression analytic radial profiles) + basaltic-plains
> datum + analytic point-to-arc rift corridors. REPLACES `carrier.height` for Venus; 5-way dispatch
> (plate→shell→volcanic→**stagnant-lid**→despun), plate/shell/volcanic/despun byte-identical. Key-based routing (NOT
> locked-gated — Venus is `locked:false`); ONE load-bearing `PRESET_ARCHETYPE` line ('Venus (sulfuric shroud)'→
> 'stagnant-lid'). **Verified:** citations re-verified (`wf_380b2e21`, all constants held) → dev-collab-scope →
> grounding+adversarial-plan (`wf_2d29dc2b`, NEEDS-FIX→7 fixes folded in) → SLICE A writer+AC1-AC5 vitest → SLICE B
> dispatch/lab+AC6/AC7 → **live AC8 driven on :5175 at the 40k mesh** (452 plume-clustered coronae, structureCorr 0.496
> ≫ latitude 0.011, ordering holds, activeFrac 0.648). 26 stagnant tests + 234 worldengine suite green. ⚠ AC2(a) metric
> is `|corr|>=0.40` (binary-mask r²>=0.5 unreachable — magmatism precedent); test at N=1500 (finer structure);
> corona pool scales ∝N for resolution-invariant coverage. **AC9 UAT = Max's gate** (open lab on Venus, bump
> pixelScale→1/drop posterize to see tessera+coronae past the retro dither). Artifacts:
> `docs/WORKSTREAMS/world-engine-venus-stagnantlid-2026-07-01/` (intent, contract, mechanism, GROUNDING via BUILD-PLAN,
> verdict). Commits `8644d4e` scope → `ed0337b` citations → `0ee9437` SLICE A → `bf7efda` SLICE B → `0a95ed9` pool-fix.
> **Push HOLD LIFTED** (branch pushed through #4-MULTIPLY; #4b not yet pushed — confirm before push).

> **▶▶ (prior) #4a volcanic/magmatism SHIPPED → #4-MULTIPLY SHIPPED via workflows.**
> **#4a (volcanic/magmatism relief writer) — ✅ SHIPPED `eb18666` (Max UAT-ACCEPTED 2026-07-01).** New
> `src/worldengine/base/magmatism.js` (`writeMagmatismSphere`): one seeded mantle-plume field → shield edifices +
> lava-plain flooding + T_ss-scaled substellar magma basin; 4-way dispatch (plate→shell→volcanic→despun), plate &
> shell paths byte-identical. Max accepted it **as the correct Tier-3 skeleton** — structure right (plume-organized,
> Lava≠Magma, edifice>plain>basin) though the LOOK reads "crude/too regular" BY DESIGN (naturalism accretes from later
> causal layers, not cosmetic noise). Rule-3 doc updates done (FEATURES.md row, verdict/contract → SHIPPED). Artifacts:
> `docs/WORKSTREAMS/world-engine-magmatism-2026-06-30/`.
> **▶ #4-MULTIPLY (volcanic driver-response + grain-aligned edifices) — ✅ SHIPPED `c9f39f9` (Max UAT-ACCEPTED 2026-07-01: thermal slider ↑ → bigger/more volcanoes on both Lava & Magma = the expected 'sizes track thermal history' response).**
> The volcanic analog of #2. **Two things, one thermal driver:** (1) plume COUNT/STRENGTH now track thermal history
> (tidal-heat + radiogenic/age) via `magmaDriversToTune(bodyDrivers)` → the existing `magmatism.js:124` tune seam
> (fixes "one giant + arbitrary smaller"); (2) edifices ELONGATE along a **derived seeded fissure fabric** (per-plume
> `magma:grain:` axis + `ELONGATION_GAIN`), aspect grows with thermal drive (fixes "crude/too-regular circular domes").
> **Byte-identical at `MAGMA_REF`** (the #2 discipline; rides the `ELONGATION_GAIN>0` guard). ⚠ The ROADMAP's "read the
> E6 grain field" plan was BROKEN (that field is zero/latitude on the volcanic path) → Max chose derived seeded fabric
> (`GROUNDING.md §4`). Built via workflows (grounding → dev-collab-scope → adversarial plan `wf_e23fd8b0-19e` BUILD-READY
> → per-slice implement/vitest → live AC6). **Verified:** AC1-AC5 vitest (956 suite pass) + AC6 live-driven by
> working-Claude on :5175 — real Lava now 12 elongated plumes (E=1.6) vs #4a's 9 circular; fixed-seed thermal sweep
> 0.275→0.90 = plumeCount 9→13, E 1.0→1.75, plume-var≫latitude-var, ordering holds throughout. **AC7 UAT ✅ ACCEPTED**
> (Max: thermal slider ↑ → bigger/more volcanoes on both Lava & Magma, confirmed expected → PASS).
> KNOWN (adversary LOW): shipped Lava & Magma both saturate the tidal axis → similar on the endogenic axis; they
> separate via the T_ss basin (pond vs sea) + gravity (Lava taller / Magma flatter); stronger contrast = a 1-constant
> tweak. Artifacts: `docs/WORKSTREAMS/world-engine-magmatism-multiply-2026-07-01/` (intent, contract, GROUNDING,
> BUILD-PLAN, verdict). Commits `634987e` scope → `3ada839` SLICE A → `2fc176a` SLICE B → `8237ac6` lab → `c9f39f9`
> helpers. **Push HOLD.**

> **▶ WORLD-ENGINE ATMOSPHERE #2 (BLACKBODY EMISSION) — ✅ SHIPPED `de4e577` (Max AC8 UAT-passed 2026-07-01).**
> Reshaped increment: the emission RENDER already existed as F32/F33 (`emissiveBlackbody` one-curve + east-advected
> `uThermalDir` hotspot + 1100K floor); the "hot giant renders cold" bug was two enable-flags defaulting false.
> #2 = (a) WIRED the Hot-Jupiter auto-glow + live `T_eq sweep` slider + master `emission register` toggle +
> retrograde east-sign, and (b) STOOD UP the tested `src/worldengine/base/emission-e.js` data-register
> (`visibleLuminance` re-anchored 1800K + Kelvin T-field substrate for #5/#6) + the missing CPU↔GLSL parity test.
> Unit PASS (AC1-3, 3× adversarial, 12/12 emission-e + 17/17 climate-e5, #3a golden hash intact). Integration PASS
> (AC4-7 live on :5177: Hot-Jupiter glows / cold giants dark; T_eq sweep red→orange→white; hotspot +14.9° east;
> emission-OFF pixel-identical to cold Jovian). **AC8 UAT PASSED by Max 2026-07-01** — screenshots in
> `screenshots/emission-*.png`. Decisions: keep shipped `(tempK/1800)^4` quartic for render; incandescent white
> core accepted (AC7 re-worded). Seed→driver derivation for the 3 interior scalars deferred to #9 (ATMOSPHERE-PLAN §e).
> **Atmosphere branch merged → L1 2026-07-01** (both tracks now in one tree; **pushed through `b996d55`** same day). Workstream
> `docs/WORKSTREAMS/world-engine-blackbody-emission-2026-07-01/`.

> **▶ WORLD-ENGINE #3a (E5 BANDS/JETS) — ✅ MAX UAT-PASSED `9c80d40` (2026-07-01).** The gas/ice-giant
> atmosphere writer. Replaces the lab shader's inline `0.25·latC·uBandCount` latitude stripe ladder with the
> climate-e5 writer's **signed, driver-organized, per-seed** band field: `writeClimateE5Sphere` (src/worldengine/
> base/climate-e5.js) emits bandField/bandNorm/turbulence/mushball/W across 4 regimes (gas-giant/saturnian/
> neptunian/sub-neptune); `bakeClimateE5Attributes` samples the SAME bandNorm onto render verts (aBand/aShear/aMush
> → vBand/vShear/vMush); `zonalBandCol` now colors from `bandVal=wBand` (planet-lod-height.glsl.js:1795), NOT
> latitude. Physics adversarially verified pre-build (7-agent workflow, all 5 laws CONFIRMED, 7 fixes applied;
> `DESIGN-physics-3a.md`). **Verdict (`verdict.json`):** unit **PASS** (AC1–AC9; verify-workstream `wf_50abf0da-f1b`
> re-ran 17/17 headless + 3/3 adversarial each — laws independently recomputed: amplitude law (Neptunian highest
> |U| at lowest energy) / Ward 54.7° pole-equator inversion / driver-flippable eqSign / shear-gated turbulence /
> distinct mushball channel / gas-giants-no-relief / determinism + golden bandField hash `-1329854088`).
> integration **PASS** (AC10–AC12 **live-driven by working-Claude** via chrome-devtools on :5176: GLSL compiles
> clean; render seam confirmed at source AND live — jets-OFF static **rotation sweep ×0.5→×3.0 ⇒ band count
> ~2-3→~6-8**, proving the running shader reads the writer field, not the old hard-coded ladder; four archetypes
> render distinct [band counts **14/11/3/3**, distinct palettes/sizes], two Jovian macroSeeds differ in band phase,
> close view = churning belts + wispy filaments (writer shear) + mushball tint, cohesive). **AC12(b)** Neptunian
> equatorial retrograde SIGN is muted-by-design live (ice giants deliberately low-contrast; band params writer-
> driven read-only) but **unit-verified via AC5**. **✅ AC13 UAT-PASSED (Max, 2026-07-01)** — flew the camera over
> the giants + re-rolled seeds live; cohesive/varied/distinct, not repetitive-3-band, not noise. **CONDITIONAL
> follow-on (named, not abandoned): belt-VISIBILITY tuning** — on Jovian ~5-6 strong belts are visible (incl. 2
> polar hoods) vs the ~14 zero-crossing readout, because only jets that clear the color window `smoothstep(0.34,
> 0.66, bandNorm)` render as saturated belts (weak mid-amplitude jets sit in the dead-zone). Accepted as "right
> number generating"; a future session can raise the visible count toward ~7-8 by narrowing the window (e.g.
> 0.42-0.58) or nudging `uBandContrast` — physics/field unchanged, display knob only. Doc close-out DONE `0f868ec`
> (FEATURES.md row, Rule 3). Atmosphere branch **merged → L1 2026-07-01**. ⚠ Global active-workstream pointer is
> on the *separate* `world-engine-magmatism-multiply-2026-07-01` (main-repo build) — left untouched; #3a is
> parked-pending-Max, not the active build. Resumed from `/tmp/handoff-world-engine-3a-live-2026-07-01.md`.
>
> **▶ PLATE/UPLIFT INCREMENT — BUILT + VERIFIED_PENDING_MAX `e07da8c` (2026-06-26).** Option-C increment 1
> (one-pass plate placement) is built, committed (local-only, **push HOLD**), and verified at the objective
> layers. NEW `src/worldengine/base/plates.js` (`writePlateUpliftSphere`, three-free): seed N centroids from
> `macroSeed` → spherical-Voronoi → per-plate Euler-pole motion → convergent/divergent/transform boundary
> stress (obliquity-attenuated) → uplift field **U** (REPLACES the latitude-band writer; sole low/mid source)
> → resolution-independent geodesic spread → bounded render-once relaxation. `route()` regime gate
> (`isEarthlikePlatePath`/`writeBodyRelief`): Earth-like→plates, else despun **byte-identical**.
> `routeAndOrder` discharge (`precipWeight`) + `computeOcean` base-level params (identity-safe, no north-star
> debt). `window._lab.plateProbe()` instrumentation. **Verdict (`verdict.json`):** unit **PASS** (AC1–AC6,
> verify-workstream re-ran 84/84 headless + 3/3 adversarial each, AC2 2/3); integration **PASS** (AC7 driven
> live by working-Claude on `:9223`, 2 seeds: **heightSource=carrier, boundary-vs-latitude variance 21–49×**,
> ocean 35%, 0 orphan/uphill, maxStrahler 5–6); **AC8 UAT = Max alone**. Built via per-AC
> implement→adversarial-audit→adjust workflows; **two independent reviews folded in** (AC2-metric-rigor →
> hardened the structure test against base-confound/self-correlation/straw-man controls; tectonics-math →
> verdict "model sound", changed oblique-convergent uplift from zeroed→attenuated, raised the AC2 test
> resolution so the geodesic belt resolves). Artifacts: `docs/WORKSTREAMS/world-engine-plate-uplift-field-2026-06-26/`
> (`BUILD.md`, `verdict.json`, `live-integration-evidence.md`). **NEXT = Max AC8 UAT** (lab-only, :9223): does
> an Earth-like body read as a coherent WORLD — plate-shaped continents, ranges at convergent boundaries,
> drainage belonging to that relief, genuinely various across seeds — not latitude bands / eroded noise? (Lab
> overlays all surface features; isolate via toggles / `reliefBakeStrength`.) UAT pass → Ship.
> **▶ LAB UI "isolate plate relief" control — BUILT + LIVE-VERIFIED (2026-06-27); AC8 UAT now UNBLOCKED.**
> New "Plate relief (UAT)" folder in `planet-lod-lab.html`: a one-click **"Isolate plate relief (AC8 view)"**
> checkbox (strips CLASH/OBSCURE/CLUTTER feature buckets, keeps drainage, forces baked relief=1, re-routes →
> plate field authors 100% of relief; OFF restores the exact prior enables via snapshot) + a **"Relief A/B:
> plates ↔ flat ocean"** button, plus the "baked relief" slider **desync fix** (one `applyReliefBake()` sync
> helper; `_lab.reliefBakeStrength` routes through it — uniform unchanged, AC2 byte-identical preserved). Built
> via understand-subagent → 3 surgical edits → multi-lens adversarial audit (1 minor finding fixed: solo→isolate
> snapshot guard) → live drive on :9223 = **PASS** (`plateProbe().heightSource=='carrier'`, boundary-vs-latitude
> variance ~22×, 0 orphan/uphill). Build note + intent/non-goals:
> `docs/WORKSTREAMS/world-engine-plate-uplift-field-2026-06-26/LAB-UI-isolate-plate-relief.md`. **NEXT = Max AC8
> UAT** with the new toggle (zoom in — renders small at distance-20). Named deferred follow-on (only if UAT finds
> the plate ranges too smooth alone): re-seat legacy orogeny F1/F4/F5 to NEST into plate boundaries — needs its
> own `dev-collab-scope` pass + brainstorm. Handoff: `/tmp/handoff-lab-plate-isolation-ui-2026-06-27.md`. Deferred
> follow-ons (named, not abandoned): precip/climate field, driver-response, game `Planet.js` port, Tier-C
> plate-motion stepping, province-as-referent rewiring, non-Earth-like regimes.
> **Lab-cosmetic follow-on (deferred 2026-06-27, Max "don't chase rabbits"):** in the isolated AC8 view the
> river-overlay ribbon reads as an unlit bright flat-blue *decal* over the lit/depth-shaded ocean (it doesn't
> belong to the sea). Root cause (lab-only, planet-lod-rivers.js): ribbon is `MeshBasicMaterial` (unlit) at
> `renderOrder:10`, color ramp `#1d3c5e→#4486bb`, scaled to ~1.0004× radius (floats above surface); ocean is
> lit `vec3(0.04,0.10,0.22)` + specular. Fix = light the ribbon so it shades like the ocean (Option 1) +/- clip
> it below sea level so it terminates INTO the sea (needs `isOcean` threaded into `buildRibbonGeometry`). NOT a
> clean one-liner; game river rendering is separate (MaterialBodyShader carve) — untouched. Diag screenshots in
> session scratchpad `diag-river-ocean-*.png`.
>
> **▶ WORLD-ENGINE HISTORY PROGRAM DESIGNED (2026-06-27) → increment 1 = DESPUN/ICE-SHELL writer (broaden-first).**
> Plate POC Max-UAT-passed ("success for the plate tectonics POC"). Via two multi-agent workflows (program-design
> `wryb3pfpb` + despun-writer design `w5wc97m7d`) the whole 9-increment history-systems roadmap + increment-1 design
> are written: `docs/WORKSTREAMS/world-engine-history-program-2026-06-27/` (`ROADMAP.md` = the 9 increments + FULL
> planet-type→increment coverage map + thin-spots-for-research; `increment-1-shell-relief-DESIGN.md` = build-ready
> despun/ice-shell writer + MUST-FIX-before-contract, headed by pinning the stress-field math). **Sequencing decision:**
> broaden-first (despun writer giving icy/volatile-cold/eyeball regimes a real history) over driver-response-first —
> max variety-per-effort + never touches the validated plate path. **NEXT (fresh session):** Max reviews the docs →
> `dev-collab-scope` increment-1 (pin the stress math + `SHELL_EXCLUDE` + verification tightenings) → per-AC build via
> `verify-workstream`. Handoff: `/tmp/handoff-world-engine-history-program-2026-06-27.md`. Thin spots flagged for
> research (ROADMAP): gas-giant storms, Venus stagnant-lid, sub-Neptune (homeless), exotic-shattered, exotics
> back-loaded into XL increment 8.
>
> **▶ INCREMENT 1 SHELL-RELIEF — SLICE A+B BUILT → VERIFIED_PENDING_MAX `54ea74d` (2026-06-27).** The despun/ice-shell
> stress-field writer is DONE. SLICE A (dispatch seam + determinism + scaffold) `70012a8`; SLICE B (the stress field)
> `54ea74d`. **What it does:** replaces the stubbed-to-zero stress in `src/worldengine/base/shellRelief.js` with real
> despun + diurnal **tidal-stress** math (despin tensor about seeded paleo-axis w0 + diurnal A=2 tensor → summed,
> rotated into {east,north}, direct-eigenvector diagonalized → thetaTraj-steered double-ridge lineaments + chaos
> overlay → carrier.height). Europa/Frozen (icy-active), Eyeball (eyeball-despun), Titan (volatile-cold) now render as
> **stress-driven** icy/despun worlds, NOT a `sin²(lat)` smear (~2→~5 of 11 archetypes genuinely distinct). Math pinned
> (adversarially-corrected) in `SLICE-B-stress-math.md`; the 3 corrections (meridional despin axis / non-degenerate A=2
> diurnal coeffs / direct-eigenvector + analytic STRESS_REF) verified honored. **Verdict (`verdict.json`):** unit
> **PASS** (AC1–AC6, 23/23 headless + 3× adversarial each); integration **PASS** (AC7–AC9 headless no-clobber/dispatch/
> seam + **AC10 live-driven by working-Claude** on :5173 (debug 9223), all 4 presets: `heightSource=='carrier'`,
> `varExplainedByStress` 0.39–0.40 **> latY AND > latW0**, `lineamentInteriorRatio` ≥2.6, `grainStressCorr` 0.77–1.00);
> **AC11 UAT = Max alone, PENDING.** Built via a build→verify→fix workflow (4 adversarial reviewers PASS round-0) then
> `verify-workstream` (`wgldmo012`, 43 agents). **A live AC10 probe degeneracy was caught + fixed before claiming pass**
> (BFS-from-high-tensile-seeds collapsed to corr=0 for despun/volatile where stress is broadly tensile → exposed a
> `reliefStress` diag field; probe predictor now arm's-length stress-geometry, zero latitude info). **NEXT = Max AC11
> UAT** (lab-only, :5173): step Europa/Frozen/Eyeball/Titan presets — accept only if each reads as a distinct,
> believable icy/despun world (cracks, cycloids, chaotic terrain), not a latitude smear, and the four feel meaningfully
> different. Renders SMALL at distance-20 (zoom in); the legacy in-shader synth (F1–F40) still overlays the carrier
> relief, so isolating may help — see the Lab-cleanup track below. **Non-blocking follow-ups:** (a)+(b) test-hardening
> pins for AC5 control-ratio-break + AC6 lineamentNode-overlap<0.2 (the load-bearing falsifiers are already green; pins
> in flight this session); (c) **AC9 CAVEAT — Titan is single-covered by its `PRESET_ARCHETYPE` line (preset unlocked →
> no locked-fallback net), so deleting that line silently regresses Titan to sin² bands.** Artifacts:
> `docs/WORKSTREAMS/world-engine-shell-relief-2026-06-27/` (`intent.md`, `contract.json`, `SLICE-B-stress-math.md`,
> `verdict.json`). **Push HOLD** (campaign-wide). Handoff resumed from `/tmp/handoff-world-engine-shell-relief-slice-b-2026-06-27.md`.
>
> **⚠ OPEN — Max's calls (don't silently resolve):** (1) **AC11 UAT** above — now with a CLEAN view (item 2 landed:
> step Europa/Frozen/Eyeball/Titan in the lab; the right "Features" panel is one collapsed "Legacy synth renderer"
> drawer). (2) ✅ **World Engine Lab cleanup DONE — `af12d67` (2026-06-27).** Renamed LOD LAB→WORLD ENGINE LAB (3
> display labels), collapsed the 5 synth groups + "Not relevant" into one CLOSED "Legacy synth renderer (F1–F49)"
> drawer (DOM-only re-parent; relevance filter keys on stored leaf parentEl → render-safe), dropped the voronoi3d
> debug spike (production uVoroCells untouched + still fed by applyDrivers). Executed directly (single-file,
> render-safe, reversible) per Max's call rather than a separate dev-collab-scope workstream; verified via
> understand→implement→3-lens adversarial review + live drive on :5173 (relevance re-sorts Rocky→Europa 15→41,
> console clean, render alive). **Deferred follow-on (named, not abandoned):** a future pass can delete the now-inert
> GLSL spike block (~L260-290) + its `uVoroScale`/`uDebugMode` uniform defs *together* (co-remove or the shader
> won't compile). Cosmetic note: the 5 synth groups sit open *inside* the closed drawer (lil-gui default-open), so
> expanding the drawer looks exactly as before — only the default view is tucked.
> (2b) ✅ **LEGACY SYNTH NOW DEFAULTS OFF — `cfbe42c` (2026-06-27, Max-directed).** The 41 legacy in-shader synth
> `*Enabled` defaults flipped true→false so the lab **boots showing ONLY the world-engine carrier** (plate/shell
> relief) — no borrowed synth detail (e.g. the frost/cryo tint that made Europa "look sort of right"), so the carrier
> is judged on its own work. **NOT broken — intentional:** all-off + a raw carrier sphere is the expected clean view;
> re-check any feature or hit **"enable all"** to restore. Carrier (`reliefBakeStrength`=1), relevance filter, base
> shading untouched. Verified the flip sticks (preset-apply makes zero `*Enabled` assignments; relevance gates via a
> multiplier; in-code comment "there is NO setPreset that re-applies `*Enabled`"); live :5173 fresh boot 0/50 enabled,
> carrier renders, holds Rocky→Europa; 468 tests pass. Drainage/rivers is pipeline-coupled (not legacy) but already
> off + gated on icy presets — re-enable when judging Earth-like carrier coherence.
> (3) **JOURNEY-vs-NOW DRIFT:** `JOURNEY.md` "Current objective" still reads the **35% SCREENSAVER-MVP** milestone (defect/
> music/10-min KRs) while the live campaign is the **world-engine history program** (60% ENRICHED depth). Reconcile the
> stated objective — Max's call. (4) **cross-tier-cycles research came back DEGENERATE** (placeholder stub, no mechanism)
> — re-run that one finding? **Other tracks landed:** ROADMAP folded with the preserved thinSpots research (`1ba3370`;
> +2 new increments 4.5 exotic-shattered, 5.5 shared-fields), research output preserved durably (`71172a1`).
>
> **▶ INCREMENT 2 (PLATE DRIVER-RESPONSE) — ✅ SHIPPED `45cca44` (2026-06-28, Max UAT-passed).** SLICE A (plumbing,
> byte-identical) `a3fe2f7` + SLICE B (calibration + lab UI, built via 2 parallel opus subagents) `143da55`. **What it
> does:** the body's real D-vector (D14 gravity / D2 volatiles / D12 tidal-heat) now reshapes the plate relief
> via a calibrated `driversToTune(D)` (gravity→UPLIFT_GAIN g^-0.5 clamp[0.4,2.5]; volatiles→CONTINENTAL_FRACTION;
> tidal→PLATE_COUNT_MIN), threaded through a NEW `bodyDrivers` channel separate from grainDrivers. Anchored to D_EARTH
> (Rocky's derived drivers: g 0.9 / vf 0.15 / tidalHeat ≈0.00174) so `driversToTune(D_EARTH)`→null→**Earth
> byte-identical** to the validated POC. Lab: 4 driver-override sliders + A/B button in the Drivers folder ("Body drivers
> → plate relief (Inc.2)") + plateProbe exposes bodyDrivers/appliedTune.
> **Verdict (`verdict.json`):** unit AC1-AC3 **PASS** + integration AC5 **PASS** (verify-workstream `wf_c793595f`,
> 3/3 adversarial each; vitest 14/14 + no-clobber harness 25/25); **AC6 live-driven GREEN by working-Claude** on :5173
> (Earth anchor `appliedTune null`; calibrated response via preset-switch + slider-drag; A/B flip; **visibly-distinct
> gravity A/B** screenshots `scratchpad/inc2-ac6-{A-tall,B-flat}.png`). **✅ Max UAT-PASSED the driver-response on
> Rocky/Ocean (2026-06-28, "these all look good").** **THEN D16 age DESCOPED at Max's direction** — age IS history, so a
> static age→continental nudge misrepresents it; its real home is the **epoch/host-editor model (#6)** + **weathering
> (#7)**. Age-drop re-verified: scoped vitest green; lab live = 3 sliders (gravity/volatiles/tidal), Rocky default
> `appliedTune null` (Earth byte-identical), gravity still responds. **✅ SHIPPED 2026-06-28** (Max UAT-passed the 3
> drivers; age descoped). **Deferred doc close-out:** FEATURES.md row + `npm run doc-rot` (skipped at ship for the
> usage-limit wrap). ⚠ **Mars sliders are INERT** (no PRESET_ARCHETYPE entry → despun
> path) — Mars correctly is NOT plate-driven (stagnant-lid in reality); its real history rides #4 volcanic / #5
> bombardment / #7 aeolian. Artifacts: `docs/WORKSTREAMS/world-engine-plate-driver-response-2026-06-27/`
> (intent, contract, SLICE-B-calibration, verdict). **Push HOLD.**
>
> **▶ INCREMENT 2 (PLATE DRIVER-RESPONSE) — SCOPED, AWAITING MAX GREENLIGHT (2026-06-27).** `dev-collab-scope` pass.
> **Active workstream switched** shell-relief → `docs/WORKSTREAMS/world-engine-plate-driver-response-2026-06-27/`
> (`intent.md` + `contract.json`, status `building`, validated, active pointer set). ⚠ **shell-relief is NOT shipped** —
> its AC11 UAT is still Max's open hands-on gate (`VERIFIED_PENDING_MAX 54ea74d`); #2 is a *sibling* effort on the plate
> path that doesn't touch the shell path, so it can build in parallel. **What #2 is:** the MULTIPLY move — thread the
> real per-body D-vector (D14 gravity / D2 volatiles / D12 tidal-heating / D16 age) through `route()`→`writeBodyRelief`→
> `writePlateUpliftSphere` via a NEW body-driver channel + a calibrated `driversToTune(D)` so PLATE_COUNT / UPLIFT_GAIN /
> CONTINENTAL_FRACTION respond to drivers. Today the plate writer ignores drivers (`void drivers`, plates.js:110) and
> varies by seed only. **Max's scoping calls (in-thread):** (1) **full driver set** (not minimal-legible); (2) accepts
> **D16 age must be surfaced first** (presets carry erosion/bombardment/resurfacing, NOT age). 7 ACs: AC1 determinism /
> AC2 **Earth byte-identity** (the load-bearing guard — `driversToTune(D_earth)`→DEFAULTS branch) / AC3 monotone
> correct-sign response / AC4 age surfaced+consumed / AC5 **no-clobber the grain bake** (separate driver channel) / AC6
> live probe / **AC7 UAT** = the UAT-RUBRICS increment-2 card folded in (two Earth-likes differing only in drivers read
> as genuinely different worlds; Earth unchanged). **#1 must-fix (calibration, build's first task):** define `D_earth`
> as a named constant + calibrate transfer fns to return DEFAULTS at the *real* Earth D-values (NOT a 0-vector;
> tidalHeatNorm≈0.19, ageNorm≈0.45). ⚠ **"Why we care" in intent.md is Claude's draft — Max to reword.** **NEXT:** Max
> greenlights `contract.json` → SLICE A (plumbing, byte-identical) → SLICE B (calibration) via `verify-workstream`.
> **Push HOLD.**
>
> **▶ PER-INCREMENT BASIS-LEVEL UAT RUBRICS — WRITTEN (2026-06-27).** Max's directive: make the basis-vs-expression
> UAT framing (from shell-relief: *"did it lay down the right BASIS?"* not *"is it believable?"*) a **standard artifact
> for every increment** of the world-engine history program. Delivered:
> `docs/WORKSTREAMS/world-engine-history-program-2026-06-27/UAT-RUBRICS.md` — one **5-field rubric card** per increment
> (Ships-as-data / Expression-path / **Visually-testable?** / Basis-level-pass-criteria / Red-flags) for all 11
> increments (1–9 + 4.5, 5.5), with #9 game port reframed as *expression-fidelity*, not basis. Grounded against live
> code: `PRESET_ARCHETYPE` (`planet-lod-lab.html:1901`) + `SHELL_REGIMES`/`SHELL_EXCLUDE` (`shellRelief.js`) → a
> **"test the PRESET the user sees, not the canonical archetype"** caveat table. **The high-value finding (the ⭐
> visually-testable column):** three increments can't be UAT'd as-is and need a proxy/probe/preset built BEFORE they're
> contracted — **#5 bombardment** (no lab preset routes to it; the only `impact-airless` preset is `Frozen`→#1), **#5.5
> shared-field pass** (ships invisible fields other writers consume → needs probes + downstream proxy), **#6 epoch model**
> (no direct look → composed-history proxy; AND its fixed-point solver is UNMECHANIZED — the degenerate cross-tier-cycles
> research = NOW-item 4 above). Also flagged: **#4.5 blocked on Max's geometry decision** (block-jumble vs diapir-grooved),
> **#8 should be split** (archetype-completers vs Tier-5 overlays = open decision c). **Push HOLD.**
>
> **▶ GRAIN-VS-LANDFORM FORK RESOLVED (2026-06-26) → answer (a) BASIS → Option-C plate-placement increment SCOPED + greenlit, build handed to fresh session via workflows.**
> The AC5 "semi-coherent" verdict was a **generative-model/content** verdict, not a wiring bug. Dig (via workflows)
> answered the fork: **(a)** — what's on screen is precursor E6 grain (latitude bands; the carve never touches the baked
> field); the landform process is genuinely deferred, not a wrong end-state. Two-part missing process: **erosion** (E9,
> already owned + UAT-passed flat) vs **construction/uplift** (unbuilt). **Then Max sharpened the bar: not "reads-as-coherent"
> but actually COHERENT** — rivers where the procgen's full history says they should be. Coherence trace: the carve IS real
> flow routing (not decoration) but is fed two historyless inputs (latitude-only height + uniform rain `accum=1`) → correct
> router over incoherent substrate = incoherent rivers. **SOTA research (Cordonnier 2016 / Cortial 2019 / Tzathas 2024)
> established a 3-tier model**: place tectonic END-STATE + run a **bounded gen-time erosion** (NOT geologic-time sim;
> compatible with locked place-once) → render once. Max's frame: **"generative, not simulative"** ("what *happened*",
> end-state determined by formation variables). **The hard gap = STAGE 1 (placing the uplift/continent field), not erosion
> (WD owns it).** Decisions: **Tier B now, built C-ready**; **branch by regime** (plate path gated to Earth-like; despun E6
> kept byte-identical for icy/locked/etc.); **lab-first**; **seed-only variety this increment** (driver-response = named
> follow-on); precip/base-level **parameterized-but-deferred** (no north-star debt). **Scoped + committed:**
> `docs/WORKSTREAMS/world-engine-plate-uplift-field-2026-06-26/` (intent + 8-AC contract, `f3662c8`, status **building**,
> active-workstream pointer set). **NEXT: fresh session BUILDS it via per-AC implement→`verify-workstream` workflows.**
> Handoff: `/tmp/handoff-world-engine-plate-uplift-field-build-2026-06-26.md`. Increment-1 baked-relief plumbing: do NOT
> revert (reusable, verified). **Push HOLD** (whole local branch since 2026-06-23).

> **▶ INCREMENT 1 (world-engine-baked-relief-render) — BUILT + VERIFIED (`e9d6cd5`); AC5 UAT → semi-coherent, see block above (2026-06-25).**
> The A-lite first step of the full-A render port. **5 phases A–E committed** (`cef95c5`→`e9d6cd5` on
> `1eb556d` plan): (A) net-new sphere-native `writeHeightSphere` — coarse E6 relief generated as DATA on a
> seam-free 3D-simplex domain (NOT lat/long), deterministic; (B) bake `carrier.height` into a seam-free 256³
> cube once-per-route; (C) lab renderer displaces from the cube behind `uReliefBakeStrength`, strength-0 =
> verbatim fallback (if/else, never mix); (D) river router re-pointed to the **same** `carrier.height` array;
> (E) seam/pole continuity gate. **The §0 invariant held: ONE field → ONE cube → BOTH consumers, ONE strength
> uniform** (the WS4 data/noise split is closed). **Verification:** AC1 unit PASS (22/22 + full-suite confirms
> the 4 pre-existing fails are untouched by the diff); AC2/AC3/AC4 integration GREEN = headless 42/42 +
> working-Claude live drive on `:9223` (**single-source router==baked diff 0 sphere-wide**; strength-0 router
> falls back to legacy; both poles no pinch + cube-corner no seam ridge); AC5 UAT **deferred-to-max**. Built
> via workflows (understand→plan→build w/ per-phase adversarial review→verify-workstream); the Phase-E
> reviewer caught a **vacuous AC4 seam test** (self-calibrated threshold) → reworked to frozen
> injection-validated thresholds. Artifacts in `docs/WORKSTREAMS/world-engine-baked-relief-render-2026-06-25/`:
> `BUILD-PLAN.md`, `verdict.json`, `live-integration-evidence.md`. **NEXT = Max AC5 UAT** (lab-only): open the
> LOD lab, slide **'baked relief (0 = synth only)'** 0→1, judge — does the relief read as **generated
> structure** (coherent landforms, not a grain on noise) with **drainage cut into that same relief**, vs the
> **WS4-scoped bar** (coherent system + drainage; NOT "where are the continents" — that's the Option-C
> follow-on). UAT pass → Ship (FEATURES row + doc-updates). Then **increment 2** = the heavy E6-build +
> E9-carve substrate swap onto the sphere. **Push HOLD** (campaign-wide). Handoff:
> `/tmp/handoff-world-engine-baked-relief-render-2026-06-25.md`.

> **▶ WS4 (world-engine-relief-wiring) — VERIFIED_PENDING_MAX `deca261` (2026-06-25).** E6 tectonic **grain** → E9 subtractive stream-power **carve** wired into the LAB (lab-only; game Planet.js deferred). One shared grain field feeds all 6 grained combiners (mix gated by `uTectonicGrainStrength`, 0=byte-identical fallback); drainage genuinely subtracts (perNodeIncision Δ≤0, epoch build-then-carve). 4 unit ACs PASS (grain-oracle, carve-subtractive, epoch-build-identical, renderer-expression-only; 3× adversarial) + 5 live integration ACs PASS on :9223 (one-shared-grain, grain-zero-identical, epoch-carve-visible, router-zero-drift ocean35/Strahler5/0-orphan-uphill/poles-clean, bake-once). **`landscape-with-history` UAT = Max's gate alone — PENDING:** walk a built world, toggle grain 0↔1 + carve epoch, judge "reads as a landscape with a history." A/B captures in `scratchpad/ws4-live/`. Built entirely via workflows (ground→plan→adversarial-critique→build→verify→live-drive). bake-once AC amended: grain is sea-level-independent. **Push HOLD** (campaign-wide).

> **▶ WS4 UAT (2026-06-25) → GENERATIVE-ARCHITECTURE PIVOT, NOT shipped.** Max walked the lab (grain slider + carve-epoch toggle + ⊞grain feature tags added for UAT, `6a172c8`). The grain *mechanism* verifies and the subtractive carve genuinely reshapes the heightfield (oceans/lakes/mountains shift). BUT UAT surfaced a fundamental gap: the procgen layer (WS1 drivers, WS2 fields) generates only a THIN latitude-banded **orientation** grain + scalars — NOT a tectonic structure/**history as DATA**; the relief is shader-synthesized noise merely *oriented* by the grain, so it reads as an orientation overlay, not "a planet with a tectonic history." That violates the spine's own **"procgen decides, render expresses / place plausible structure once per body"** principle (`world-engine-architecture-spine.md` §0/§1). **Decision: do NOT ship WS4; do NOT start WS3.** WS4 = reusable foundational plumbing (one shared field + a real subtractive carve). **NEXT (Max's directive): a FRESH session examines the GENERATIVE ARCHITECTURE *via a workflow*** — map what's generated as data vs synthesized in the shader across game/lab/world-engine → assess vs Max's "generate tectonic history as data → render it" vision → research prior art (procedural plate tectonics / structural heightfields) → recommend a direction → then brainstorm with Max before any build. Handoff: `/tmp/handoff-world-engine-generative-architecture-rethink-2026-06-25.md`. Push HOLD.

> **▶ GENARCH ASSESSMENT DONE → DIRECTION SET → INCREMENT 1 SCOPED (2026-06-25, this session).** Ran the
> architecture-examination workflow (14 agents: map+research+2 assess+3 adversarial critique) → committed
> `docs/FEATURES/world-engine-genarch-assessment-2026-06-25/ASSESSMENT.md` (`6787146`). **Verdict: the DIRECTION is
> right** — "procgen writes structure as DATA, render expresses it" is validated by the UAT-PASSED relief slice AND
> every production planet renderer + SOTA paper surveyed. **WS4 failed UAT because it wired only the orientation grain
> into the production shader; the relief HEIGHT stayed in-shader noise** (`height.glsl.js:950` mixes grain as an axis,
> `:972` keeps height `noised()`). 3 critics returned **refuted=false** (core call survives) but flagged that the
> synthesis OVER-SELLS the fix → folded into **ASSESSMENT.md §11**: full-A is bigger than rated (NO sphere-native height
> writer exists; E9 is flat-only), the slice's flat-DEM divergence UAT does NOT transfer to a sphere
> "reads-as-history" UAT, an **A-lite** coarse-elevation-bake middle path was never priced, **D12 zero is
> `PlanetGenerator.js:606-613` not :565** (WS1 already surfaces tidalHeating — gap is consumption), and **WS4's UAT bar
> EXCLUDES continents** (intent.md:15-16 defers them to E7/E8/E11 + Option C). **Max's call (verbatim): stop bouncing
> micro-decisions — proceed toward the outcome.** Direction locked: **reopen decision #6**, renderer expresses **baked
> structure-as-data** (full-A = destination); **B dead**; **C (one-pass plate model for continents) = follow-on**.
> **SCOPED increment 1: `world-engine-baked-relief-render-2026-06-25`** (intent+contract committed `f3e8c30`, status
> building, active-workstream switched) — reach full-A via an A-lite-shaped first increment: bake a COARSE sphere-native
> height field → DISPLACE the surface from it + re-point the river router at the SAME field + seam/pole continuity (the
> critics' first AC), de-risking the sphere/dual-source plumbing before the heavy **E6-build+E9-carve-substrate swap =
> increment 2**. 5 ACs (AC1 unit, AC2-4 live integration on :9223, AC5 Max UAT vs the WS4-scoped bar). **NEXT (fresh
> session, build via subagents per Max): present contract for greenlight → plan → build → `verify-workstream` →
> VERIFIED_PENDING_MAX → Max UAT.** LAB-only. Push HOLD. Handoff:
> `/tmp/handoff-world-engine-baked-relief-render-2026-06-25.md`.

> **▶ LATEST (2026-06-20): river-LOD methodology SPEC done + Max-approved → BUILD next.** Pursuing
> river scale via a GENERAL structured-feature-LOD methodology (instance #1 = rivers). Brainstormed
> WITH Max + approved. Spec: `docs/superpowers/specs/2026-06-19-structured-feature-lod-methodology-design.md`
> (commits `19f98b3` + radius `a21a5e7`, local-only). Decisions: ribbon(legibility)+carve(co-dependence)
> render; α-carries-zoom / gridRes fixed-per-feature-per-planet ~448 (O(Nf²) snap→O(1) hex-lattice
> inverse); 3 full-strength co-dependence reads (real height, sea-level outlets, ocean-mask bake);
> static-cap v1; **legibility GPU gate** (LEGIBLE not just DIFFERS). Radius = realistic seed-derived
> `state.planetRadiusEarth·6371`, no gen change. Pickup spec: `docs/superpowers/specs/2026-06-19-structured-feature-lod-methodology-design.md`.

> **▶ LATEST (2026-06-20 late): both legibility decisions RESOLVED → threshold done + ribbon
> UN-OCCLUDED; next = lightweight port-READY pass.** (1) §8.10 fine-channel render threshold:
> default 4 + GUI slider, committed (through `21e4e2a`), twice adversarially reviewed. (2) **Ribbon
> un-occlude: committed `eeddaab`** — `riverOverlayState.ribbonLift` (default 1.0014) applied as a
> uniform mesh scale to both ribbon meshes (carve `LIFT` 0.999 untouched), `depthTest` stays true,
> new `ribbon lift (occlude↔float)` GUI slider; verified live (trunk ribbon now renders over the
> surface, far hemisphere occluded). Cluster **369 green**. Max reframed: build river-LOD
> **port-READY** (radius-param the geometry + a port-contract doc) WITHOUT wiring into the game.
> **NEXT SESSION:** `/tmp/handoff-river-lod-portready-2026-06-20.md` (two parallel `code-explorer`
> runs already mapped both pipelines — both are non-displaced spheres; the river stack is mostly
> portable-core; the carve is a surface-shader graft). **STILL Max-owned:** UAT of ribbon-vs-carve
> reading (now unblocked) + the deferred graft-vs-replace renderer-unification call.

> **▶ LATEST (2026-06-20, port-ready pass LANDED).** Both pieces done, local-only on master.
> (§1) **Radius-parameterized the ribbon builders** (`63159a6`): `buildRibbonGeometry` +
> `buildFineRibbonGeometry` take `params.radius` (default 1.0 = lab no-op); the whole ribbon scales
> uniformly (centerline `dir*radius*LIFT` AND width `*radius`) so the game's
> `IcosahedronGeometry(d.radius,5)` surface is supported. **Audit's sharper finding:** only the two
> RIBBON builders depend on radius — `buildValleyGeometry` (direction-keyed carve cube) +
> `buildFineValleyGeometry` (angle-keyed ortho patch, planar tan-space) are radius-invariant by
> construction, deliberately NOT threaded. `radius` orthogonal to `radiusEarth` (width) + `ribbonLift`
> (mesh scale). TDD `tests/planet-lod-river-radius.test.js`; cluster **369→374 green**; live-verified
> default path renders rivers unchanged (ribbon radii=0.999=LIFT). (§2) **Port-contract doc**
> (`0233cf3`): `docs/FEATURES/river-lod-port-contract.md` — portable-core modules, the
> `sampleCarve`/`uRiverCarve*`/`uSeaLevel` shader graft, radius param, ribbon-lift + logdepthbuf/
> no-polygonOffset caveats, lab-glue to re-implement; linked from divergence §4. Contract not a plan —
> wiring stays deferred. **STILL Max-owned (unchanged):** UAT of ribbon-vs-carve (esp. grazing angles)
> + the graft-vs-replace renderer-unification call.
>
> **▶ LATEST (2026-06-20, Phase-5 Integration SCOPED — planning only, local).** After the
> feature-interaction audit (`0606313`: 84 edges → 52 gaps), Max approved scoping it as a campaign
> and delegated the framing call to working-Claude. **Call made:** it IS campaign **Phase 5
> "Integration"** (was `pending`), reframed from verify-only → *build the couplings*; the I-1…I-15
> checks become the acceptance layer run AFTER the builds. 52 gaps sequenced into **WS1–WS5 +
> cross-cutting**, full gap→WS + I-check→WS mapping in the new
> **`docs/FEATURES/planet-lod-phase5-integration-plan.md`**. WS1 (keystone: surface the discarded
> per-basin `filled` → lake mask + rim breach; closes 7 gaps incl. Max's crater-lake example) =
> recommended FIRST build. WS5 = cross-link to the existing `rivers-viewdependent-lod-2026-06-18`
> workstream (NOT duplicated). **Second call: planning-only this session** — each WS is built via its
> own `dev-collab-scope` pass when Max greenlights it (none built yet; respects the scope+UAT gates).
> Updated: CHARTER program-3 line, campaign-tracker Phase-5 row, INTEGRATION.md header pointer,
> view-dependent intent (WS5 role). All local/unpushed.
>
> **▶ REFINED (2026-06-21, via workflow `wf_df308f40-79d`).** Max's topo-map observation —
> *the same tectonic activity produces both mountains AND the structured valleys that shape
> rivers* — exposed a blind spot. Code-verified (4-agent workflow): the river router DOES route
> on real finished mountain relief (RTT of the real combiner chain → priority-flood; lateral read,
> WIRED, I-1), so the visible effect mostly works. BUT the engine has **no shared tectonic
> lineament field** — relief features share only a scalar province amplitude-mask (`gProvince.x`),
> each with its own seed-hashed axis; inter-range lows are incidental noise minima, not orogenic
> drainage corridors. So **shared-driver CO-GENESIS** (one cause → many coherent features =
> *vertical* coupling) is categorically distinct from the audit's 52 gaps (all *lateral*
> output-reads) and was never enumerated (audit rubric excludes shared-driver as "co-occurrence").
> Added to the plan: a **"lateral reads vs. vertical co-genesis" scope-boundary section** + **WS4
> sub-item 7 (orogenic drainage-corridor co-genesis, mountains↔rivers)** — fidelity-tier, below WS1,
> kept DISTINCT from WS4's relief×relief partition generator (don't conflate). Plan + NOW.md updated;
> local/unpushed.
>
> **▶ (2026-06-20 PM): §7 BUILT + headless-green + review-hardened; live GPU gate run →
> objective plumbing PASSES, but LEGIBILITY needs 2 Max decisions (NOT a clean pass).** 4 commits on
> master (local-only): `7de1f7d` §7.1 co-dependence field-reads (height coeff 1.0 / sea outlets /
> ocean mask), `38f817c` §7.2 O(1) hex-lattice inverse + seed-derived gridRes, `d220d04` §7.2 review
> fixes (snapToLattice rim-widen + skip O(Nf·N_base) macro scan on GPU path — both HIGH-sev, caught by
> a 10-agent adversarial review workflow), `0135fdc` §7.3 fine ribbon + order-graded dry→flood carve.
> Headless: **366 green** (was 339; +27 new across 3 test files). **GPU gate (page 3, `:9223`)
> findings:** pipeline wired (segmentCount ~200k), console clean, **regression-safe at strength 0** ✓,
> fine CARVE adds finer dendrites that read (A/B differs, legible at a higher channel threshold) ✓,
> feeds-the-sea/ocean-mask headless-verified ✓. **TWO open decisions (Max's, UAT-layer):**
> **(1) fine RIBBON (Fork A) is depth-OCCLUDED** in the lab — the TRUNK ribbon is too (LIFT 0.999 sits
> inside the radius-1.0 sphere) → rivers read via CARVE flood/dark-floors only (matches the handoff's
> "shipped rivers read via flooding, not ribbon"); Fork A is a no-op here until the ribbon is
> un-occluded or the game-port. **(2) DENSITY**: at the derived gridRes 550 the default fine-channel
> threshold (Strahler≥2 → ~102k channels) reads as a SMEAR; a higher render threshold (≥4 → ~22k)
> reads as legible dendrites — needs a default-raise + a GUI slider to tune. Gate screenshots:
> `river-lod-gate-{A..G}*.jpeg` (repo root, NOT committed). Campaign memory updated with full findings.

> **🧭 Working the planet-LOD lab? READ `docs/FEATURES/planet-lod-CHARTER.md` FIRST** — it's
> the durable strategic frame (lab≠game by design, the program arc, the canonical model
> location). It exists because fresh sessions keep losing that wider context. Then NOW.md
> (this file) for live state + the tracker for which feature is next.
>
> **Parallel campaign note (2026-06-13):** The supercruise/warp content below remains the
> paused primary workstream. SEPARATELY, the **planet-LOD campaign** (tracker:
> `docs/FEATURES/planet-lod-campaign-tracker.md`; pickup memory `well-dipper-lod-terrain-campaign.md`)
> shipped **F51 rings v2** (3D-LOD particle ring, impostor far + emergent THREE.Points cloud near,
> 6 lab sliders) → 🟢 VERIFIED_PENDING_MAX `71eea7a`, Max approved-in-principle, awaiting his
> slider-driven UAT. Phase-4c remaining: F38 airglow + F39 cloud-optics (build both).
> Next session (Max's ask): **review the overall feature-development roadmap for the LOD lab**
> (`docs/FEATURES/planet-lod-campaign-tracker.md` — phases 1→7, F1–F51 status). Orientation,
> not a brainstorm. Handoff `/tmp/handoff-f51-lod-workstream-2026-06-13.md`.

> **▶ ACTIVE WORKSTREAM (2026-06-15/16): `planet-scale-normalization`** — Theme B of the
> LOD-lab quality backlog (`docs/FEATURES/lod-lab-quality-backlog.md` #2). Building a **real-units
> scale system** into the lab (planet radius + feature sizes + relief heights in km; `deriveUniforms`
> converts to unit-sphere uniforms). Scope/design/contract in
> `docs/WORKSTREAMS/planet-scale-normalization-2026-06-15/` (intent + design + 10-AC contract).
> **Phase A done** (`a329891`: conversion helpers + `radiusRangesEarth`→`ScaleConstants` extraction,
> oracle 13/13, gen-guard 85/85). **Crater slice done + Max-approved** (`c32374d`). **SHIPPED 2026-06-17 — Max UAT-PASSED + PUSHED
> (`aafa94c`, runtime `dc04806`).** Footprint fan-out + AC3 relief (physically-
> plausible heights × gravity factor, M2) + AC4 animation-rate + AC5 seeded size-source (named-body
> locks vs archetype draws, M3) + self-resetting-slider fix + AC7 km readout all landed.
> `verify-workstream` ran: AC6/8/9 PASS (3/3 adversarial); AC2/3/5/7 PASS live on :9223 (evidence in
> `scale-gallery.html`); AC1 calibration test added + AC1 reworded to the AC8 architecture; AC5
> headless-oracle logged as test-debt. **Max UAT-PASSED (AC10) 2026-06-17 → Shipped + pushed.** AC4's
> small-world lava-rate floor is DEFERRED — Max scoped **lava itself as the next Theme-A re-think**
> (backlog #10, rivers-style), so the rate tweak waits until that restructuring. Handoff:
> `/tmp/handoff-planet-scale-normalization-crater-slice-2026-06-16.md`.
> **▶ Rivers (Theme-A #3) sphere-seam viability spike: VIABLE (`e2f3bb5`, 2026-06-17).** Seam-free
> dendritic drainage proven on an **irregular spherical Delaunay mesh** (regular icosphere grid-locks
> channels straight); G1 (routing) + G2 (dendritic look) both Max-eye-approved; conform-only suffices
> (carve deferred). Plan/verdict: `docs/FEATURES/rivers-sphere-spike-plan-2026-06-17.md`.
> **▶ Rivers full feature SCOPED + Max-GREENLIT (2026-06-17, scope commit `e9ea4b5`).** A 2nd
> (terrain-coupling) spike passed (C1–C4, C3 Max-eye-approved; `rivers-terrain-lab.html` untracked).
> ⭐ **Render method = ribbon-geometry OVERLAY, NOT texture-bake** (the research/older-plan bake-path
> framing is STALE — superseded). 8-AC contract in
> `docs/WORKSTREAMS/rivers-dendritic-drainage-2026-06-17/` (intent + contract; AC1 shared-height-GLSL
> module, AC3 sea-level-from-histogram = the two coupling-spike findings). Active workstream flipped to
> rivers. **BUILD IN PROGRESS:** **AC1 (shared-height-module) DONE `8fcfaeb`; AC2+AC3 DONE + committed
> `03cf22a`** (2026-06-18). AC2 (real-terrain RTT coupling) — router lab reads the lab's REAL h+grad at
> ~40k verts via the SHARED AC1 modules (the "both consumers" proof); verified live on :9223: h+grad
> finite, ocean == real level-set, terrain dial moves the read-back heights; zero-drift vs the spike;
> obsolete verbatim copies removed, router lab graduated to tracked source. AC3 (sea-level-from-histogram,
> TDD) — `planet-lod-sealevel.js` inverse-CDF solver (6 oracle tests); per-planet sea solve lands all 5
> reseeds at exactly 35% ocean (was ~13%). Also fixed an AC1 regression `planet-archetypes.test.js` missed
> (GLSL-mirror parse repointed to the shared module). 273/273 planet cluster green. **AC4 (ribbon overlay
> on the actual lab planet + retire F11) DONE + committed `c3f0e7b`** (2026-06-18). Extracted the proven
> router/ribbon pipeline into a SHARED module `planet-lod-rivers.js` (AC1-style, no third verbatim copy) —
> repointed the router lab at it as a zero-drift regression gate (stats reproduce: ocean 35%, orphan/uphill 0,
> maxStrahler 5), then wired `createRiverOverlay` into `planet-lod-lab.html` bound to the lab's LIVE uniforms.
> Ribbon parented to `planet` (co-rotates), lazily mesh-built on enable (556ms), re-route reuses the cached
> mesh (133ms — AC7 preview). New "Rivers — dendritic overlay (AC4)" GUI folder: enabling forces F11 off
> (state.riversEnabled→0, the per-frame gate) and drives the planet sea to the histogram 35% so water + river
> outlets agree. LIVE-VERIFIED on :9223 from 4 viewpoints (equator, BOTH poles clean = no pole/seam artifact,
> basin close-up): dendritic network, trunks to seas, tributaries branching upslope, no F11 double-pattern,
> 0 console errors. **Max review of AC4: "looks good but isn't integrated, it's like an overlay."** →
> **AC4 INTEGRATION WIP committed `b0e8f08`** (river→landscape carve; default-off toggle, planet byte-identical
> when off): de-glow + seat (deep-water palette, LIFT 0.999) + **valley carve** — routed network rasterized
> into a direction-keyed depth CUBE map (`buildValleyGeometry` + `createCarveCubeMap` in planet-lod-rivers.js;
> shader samples by surface dir → bends normal into a V + darkens floor, along the REAL network so no F11
> worm-trails; cube → no seam/pole). GUI sliders (carve depth/floor). Router lab regression holds.
> **2 OPEN ISSUES (Max, next session — handoff `/tmp/handoff-rivers-AC4-carve-2026-06-18.md`): (1) channel
> edges too smooth/artificial (Chaikin + clean V → need natural roughness/meander); (2) valleys don't FILL
> with water (carve darkens the floor but doesn't lower h, and the water ribbon is thinner than the valley →
> dry groove + thin line, not a water-filled channel).** Then AC5 (routing metrics; ⚠ R_b 6.16 at 35% ocean
> vs [3,5.5] band — address via CHANNEL_ORDER/width-law/ocean-target) → AC6/AC7. Build handoff
> `/tmp/handoff-rivers-build-2026-06-17.md`.
> **▶ AC4 carve — the 2 review fixes LANDED + committed (2026-06-18):** (1) **edges roughened** —
> carve depth + wall gradient × a surface-keyed fbm (breaks the clean Chaikin V; rides ON the real
> network, no F11 worm-trail); (2) **valleys FILL with water (Max chose Option B)** — the carve now
> lowers `h` BEFORE the F14 sea cut so the floor drops below sea level and floods via the same
> level-set as the oceans (water albedo + glint + coast for free). Both gated by `uRiverCarveStrength`
> (default-off ⇒ planet byte-identical). All shader-side in `planet-lod-lab.html` — `planet-lod-rivers.js`
> UNTOUCHED, so router-lab regression is structurally safe. 2 new live sliders (flood depth, edge
> roughness). Live-verified on :9223 (before/after close-up basin); 282/282 planet tests green.
> **▶ THEN Max reframed the whole feature → SCALE (2026-06-18, this session's pivot):** current rivers
> are **continental-width + radius-INDEPENDENT** (40k mesh ⇒ ~88km cell floor; ribbons 14–285km wide,
> valleys ×4 >1000km) — they look planet-spanning, not riverine, which is why they're visible from orbit
> when real Earth rivers aren't. Max's framing: current global-bake tech is RIGHT for small bodies /
> large channels (with mods), but for Earth+ it's "scaled up way too far," AND rivers must compose with
> the OTHER terrain-modification combiners (they form as part of the terrain, not an overlay).
> **Decision: scope AC6 (scale-coupling) properly** — bigger than the contract's current AC6 ("width+mesh
> scale with radius_km" via Theme-B): now also (a) the resolution-floor reality (Earth rivers go
> sub-visible / need a local/zoom-gated regime, not just "finer"), (b) rivers as a first-class member of
> the combiner chain. **Next session: dev-collab-scope pass to revise AC6** (grounded in the Theme-B km
> scale system that already exists + the two-regime split). NOTE: the geometric carve was DEFERRED in
> intent.md but Max REOPENED it (now landed) — note the reversal when the contract is revised. Handoff:
> `/tmp/handoff-rivers-AC6-scale-scope-2026-06-18.md`.

> **▶ F11 RETIRED + DENDRITIC RIVERS MADE FIRST-CLASS `076f586` (2026-06-19, post-ship).** Max:
> remove the old F11 river feature + wire the new one like the others (checkbox by the folder
> name). Done via subagents. Removed the F11 worm-trail VISUAL (height-carve + `fluvTint`) + its
> GUI folder; promoted the dendritic network to THE rivers feature with full first-class treatment
> (title-bar enable checkbox + ⓘ info + relevance filter via the `rivers`/`state.riversEnabled`
> key; folder → 'Rivers & valleys (F11)'). Verified 282/282, backtick parity even, rivers off/on
> confirmed live on :9223. **⚠ BEHAVIOR CHANGE — deltas dormant:** F12 `deltaCombiner` is spatially
> gated by `fluvialWet`, seeded ONLY by the F11 network (shared `planet-lod-height.glsl.js`); F11
> off ⇒ `fluvialWet`=0 ⇒ delta aprons dormant until re-coupled to the dendritic mouths. F13 outflow
> unaffected. This is the lead-in to the next workstream. Push PENDING Max. Handoff:
> `/tmp/handoff-rivers-fluvial-coupling-2026-06-19.md`.
>
> **▶ NEXT WORKSTREAM (scope, don't build yet) — FLUVIAL FEATURE CO-DEPENDENCE.** Max's priority:
> generation where features inform each other → distinct 3D landforms (not "semi-homogeneous slop").
> First concrete step: spatially couple the fluvial family (F12 deltas, F13 outflow, F20 coast) onto
> the dendritic carve map so they form AT the real rivers. Validated feasible (subagent, 2026-06-19):
> carve map = HalfFloat RGBA cube, **R=depth, G/B free**, built once per route. Need: retain the
> router graph (`strahler/receiver/accum`, currently discarded), bake mouth field (F12/F20) +
> Strahler order (F13) into spare channels, and make the network route unconditionally per planet
> (always-on) so always-on features can read it. Findings:
> `~/briefings/welldipper-carvemap-coupling-feasibility-2026-06-19.md`. Scope via `dev-collab-scope`
> (spans 2+ systems). Slug suggestion: `rivers-fluvial-coupling-2026-06-19`.

> **✅ GLOBAL RIVERS SHIPPED `f45c804` (2026-06-19).** Max's AC8 UAT passed — walked the clean
> Earth-like lab on :9223 (Rocky preset, seed 1, frozen, distance 2.6, all 3 fixes live: relief
> gate 0.18 / wall-bend 0.01 / per-seed width 0.773, 0 width violations) and called it: *"looks
> good to me."* Rivers read as real dendritic drainage to the seas, no longer cut through
> mountains, sized right, a clear win over the old F11 worm-trails. No tuning changes; defaults
> stand. All 8 ACs green (unit + integration driven live 2026-06-18 + UAT). `verdict.json` →
> SHIPPED; `contract.json` status → SHIPPED. **DEFERRED BY DESIGN:** the route itself still
> crosses rendered ridges (40k global mesh can't resolve them) → the already-scoped
> **`rivers-viewdependent-lod-2026-06-18`** workstream, the next pickup (Max's sequencing). Was
> VERIFIED_PENDING_MAX `f45c804`; pushed to origin/master last session.
>
> ---
> *History below (chronological, oldest of this thread at the bottom):*

> **▶ AC6 SCOPE PASS DONE + Max-GREENLIT (2026-06-18, commit `2669e53`).** dev-collab-scope pass.
> Max sharpened "realistic at scale" → **realistic from a SPACECRAFT POV** (Elite-Dangerous: far orbit
> down to "planet fills the viewport, just above atmosphere"). The single global 40k-vertex bake
> structurally can't resolve thread-thin close-approach rivers (≈140km vertex floor, ≈14km min width) →
> **the close-approach realism SPLIT OUT into a new spike-first workstream:
> `docs/WORKSTREAMS/rivers-viewdependent-lod-2026-06-18/`** (intent + 7-AC contract, validated). Arch is
> research-forced (5-agent prior-art + code-map scan in the two `research/` dirs): keep the existing
> global route as a LOD-independent **authority**, deterministically **amplify** local detail (Dendry,
> Gaillard I3D 2019) conditioned on it; **evaluate SDF-in-shader render vs the current ribbon** (S5
> reverses the global overlay's "ribbon, NOT SDF" call — sub-pixel ribbons shimmer). S4 (faint-at-orbit →
> resolve-on-approach) KEPT. Integration = rivers **sit/drain in the composed terrain** (read-coupling,
> mostly owned); physical back-coupling (crater lakes, mouths, burial) DEFERRED + named. The
> small-body/large-channel idea is a parked hunch. **AC6 in the GLOBAL contract reduced to the
> macro/proportioning layer only** (+ forward-pointer; stale line refs fixed). The earlier "two-regime
> split" framing in the handoff is SUPERSEDED (small-body parked; the work is the Earth+ spacecraft regime).
> **SEQUENCING (Max): FINISH GLOBAL RIVERS FIRST** — remaining AC5 (R_b=6.16 @ 35% ocean vs [3,5.5] band),
> AC7 (regen budget), AC8 (Max UAT) — **THEN** start the view-dependent spike. Active workstream stays
> `rivers-dendritic-drainage-2026-06-17`.

> **▶ GLOBAL RIVERS → VERIFIED_PENDING_MAX `d420c85` (2026-06-18).** Sequence (Max's pick: AC6 hookup →
> verify → UAT) executed:
> • **AC5 routing metrics** `74bbe87` — added the missing monotonic-width metric (reads 0); R_b guard band
>   **calibrated [3,5.5]→[3,7]** per Max ("calibrate to reality": 6.16 is a global-POOLED estimate, textbook
>   3-5 is per-basin; every structural check clean + look eye-passed at AC4, so calibrate the yardstick, don't
>   retune generation). All 7 metrics pass: orphan/uphill/widthViolations 0, maxStrahler 6, near-collinear 0%,
>   median turn 30.7°.
> • **AC6 scale-coupling** `d420c85` — radius-coupled the global overlay: object-space river width ∝
>   1/radiusEarth (inverse of the Theme-B `featureFrequencyFromKm`), `widthRadiusFactor`/`paramsForRadius` in
>   `planet-lod-rivers.js`, threaded via `route({radiusEarth})`, wired from `state.planetRadiusEarth`. Live
>   RE1→RE3: factor 1.0→0.333, network valid, smaller disk-fraction. Mesh-res scaling **deferred-by-design** to
>   the view-dependent workstream (a 40k global mesh can't resolve big-world thread-thin rivers).
> • **AC7 regen budget** — live-verified: mesh built once (710ms), NOT rebuilt on sea-level OR terrain change
>   (mesh-ref stable), re-route 113-202ms.
> • **verify-workstream** (`wf_d829c028-886`, full, liveBranch=main): Unit PASS (AC1/AC3); the 5 live-integration
>   ACs I drove green on :9223 (working-Claude); AC4's stale "floating ribbon ~R*1.001" wording **reconciled** in
>   the contract (shipped = LIFT 0.999 seated + carve Option-B flood). `verdict.json` written. **AC8 UAT = Max's
>   gate, OUTSTANDING** — load a wet preset (~35% ocean), overlay ON, judge vs the old F11 worm-trails.
> Pushes NOT done (Max confirms). After UAT-PASS → start the view-dependent spike (`rivers-viewdependent-lod-2026-06-18`).

> **▶ UAT 3 FIXES BUILT + verified → re-VERIFIED_PENDING_MAX (2026-06-18).** All three landed on `master`
> (unpushed); rivers/planet cluster 282/282; router-lab regression re-checked clean (0 orphan/uphill,
> Strahler 5, R_b 5.15). **Item 3 (biggest) ROOT-CAUSED** via systematic-debugging + live carve-OFF A/B:
> the artifact is the **carve, applied UNCONDITIONALLY** along the routed network (never checking local
> rendered relief); the route sits on high ground because the 40k mesh **aliases** terrain (adjacent verts
> differ up to 35% of the height range) — the deep resolution gap = the deferred view-dependent workstream.
> Max chose **Layer-1 relief gate**: `348b7a0` — new `uRiverCarveGateHi` (0.18) gates carve depth + wall-bend
> + floor-darkening by the shader's own per-pixel `h` (the only field that sees the sub-mesh ridge), so it
> incises lowland valleys but fades on peaks ("features work together"). **Item 2** `ce84c1f` — wall-bend
> (`carveStrength`) default 0.7→0.01, slider re-ranged 0–0.15. **Item 1** `827e40f` (both levers, Max-picked):
> floor `WIDTH_RADIUS_FLOOR` 0.2→0.08 (r11 now 0.091=1/11, was clamped) + per-planet seeded width draw
> `widthSeedFactor(seed)`∈[0.6,1.5] threaded `route({widthSeed:state.macroSeed})` (live: seed 1/7/42 →
> 0.773/0.631/1.469, deterministic; same-terrain A/B visibly thinner/thicker). All identity-safe. **NEXT:
> Max UAT on :9223 (lab live, all 3 in); optional `verify-workstream` re-run; intent honesty on the
> read-coupling ceiling reconciled in the contract.** Handoff: `/tmp/handoff-rivers-UAT-fixes-2026-06-18.md`.

> **▶ MAX UAT (2026-06-18) RETURNED 3 FIXES — workstream REOPENED (not shipped).** Handoff:
> `/tmp/handoff-rivers-UAT-fixes-2026-06-18.md`. In Max's words: (1) **scale must go SMALLER, seed-dependent**
> (today width is seed-invariant + floored at `WIDTH_RADIUS_FLOOR 0.2`); (2) **"wall bend (normal)" looks
> best at ~0.01** (`carveStrength` default 0.7 → re-default/re-range); (3) **BIGGEST: rivers cut straight
> INTO mountains/high terrain instead of flowing down/around** — "all features that modify terrain height
> need to work together." Ruled out = missing combiners (`ROUTER_MAIN` runs the full chain). Prime
> hypotheses: (A) router under-resolves fine relief (40k verts ~140km + `octavesDuringRead:9` vs full-res
> shader → routes across peaks it can't see); (B) carve is unconditional along the path → gouges trenches
> through rendered mountains. Fix is an INTEGRATION decision (raise router fidelity vs relief-aware
> routing/carve vs. it may force starting the view-dependent workstream) — brainstorm with Max, don't
> param-nudge. **Next session: fix item 3 first (systematic-debugging), then 1 + 2, then re-run verify.**

> **Feature-association manifest — Tier-1 + Tier-2 landed (2026-06-14):** Tier-1 added the
> cross-source (vs-shader) test tier + grounded defect fixes (`modifies` DERIVED from
> `dependsOn.features`; massWasting deps→20 grad-writers; lakes→frost/dust/sunglint/cityLights;
> spurious lakes→rivers deleted; hexTess `rendersOnDivergent`). **Tier-2 (Phase 2 + 2.5) now
> SHIPPED (`4ae2507`, `cb05c43`, `9d13d01`, master, unpushed):** non-destructive solo +
> isolationKit-aware soloMode (`lab-isolation.js`, 7 tests); pure render-auditor
> (`lab-render-audit.js`, 3 tests); live GPU render-delta sweep (`window._lab.renderDeltaSweep()`
> over all 17 presets, :9223). **Audit report = `docs/FEATURES/lab-render-audit.md`** (generator
> `scripts/gen-render-audit.mjs`, raw `docs/FEATURES/.sweep-raw.json`). Measures PLAYER-VISIBLE
> render via a **natural-baseline** A/B delta (relevantFeatureSet ∪/∖ feature), 2 hemispheres × 3
> uTime samples. **Findings: 109 false-renders (92 solid), 85 dead-renders, 0 degenerate** —
> dominant: civilization overlays (machine/cityLights/ecumenopolis/bioMats) paint on ALL 17
> presets incl. gas giants (visually confirmed: Jovian in a city-lights grid); exotic geometry
> (hexTess/shatter) leaks onto rocky presets. **STOPPED at the report per plan — violations are a
> punch-list for Max to triage (manifest-wrong vs feature-buggy), NOT auto-fixed.** Methodology
> diverged from the plan's solo+kit baseline (documented in the report; flag for Max if a
> capability lens is also wanted). lightning dead-renders flagged LOW-CONFIDENCE (sparse transient).
> Tests: 21 green + 1 skip.
>
> **RECONCILED (2026-06-14): lab renderer ≠ game renderer — by design.** Max picked lens C.
> The lab's feature/archetype/association model is a **deliberately-decoupled staging ground
> for a next-gen planet renderer**, NOT the game's source of truth and NOT a throwaway sandbox.
> The game still runs the March-2026 **type-branch** shader (`Planet.js`, gated by a `type`
> string via `PlanetGenerator._pickType` → `ExoticOverlay.apply` → `_typeIndex` dispatch); the
> lab runs a **feature-composition** shader (`planet-lod-lab-core.js`, the F1–F51 campaign +
> provinces). They share ZERO shader code. Game-wiring is an explicitly-deferred, no-parity
> separate effort (Max-approved campaign spec, 2026-06-09 L8-9/L224) with no plan/scope yet.
> The "Venus/Mars cities" worry was a lab force-enable artifact — in-game Venus stays type
> 'venus' and never hits the city-lights branch. **Durable record + the deferred-port decisions:
> `docs/FEATURES/lab-vs-game-renderer-divergence.md` (keep until the port happens).**
> Handoffs: `/tmp/handoff-archetype-game-audit-2026-06-14.md`, `/tmp/handoff-manifest-tier2-render-audit-2026-06-14.md`.
>
> **▶ CURRENT FOCUS (Max, 2026-06-14): make the LOD lab itself good — not game-wiring.** Two
> phases: (1) **catalog — DONE 2026-06-14.** The comprehensive planet-type×feature×driver model
> already existed (`docs/FEATURES/planet-visual-features.md`: L0 drivers D1–D16 → L1 processes
> P1–P28 → L2 features F1–F53, + Appendix A 18 types), and the game's `PhysicsEngine.js` already
> computes those drivers (incl. `habitabilityScore` as a result of composition/atmo/magneto/orbit).
> The recent manifest had DRIFTED from it (hand-listed derived lab uniforms, 16/47 driver stubs).
> **Re-based all 47 on D1–D16:** new `planet-drivers.js` (canonical DRIVERS D1–D16 + PROCESSES
> P1–P28 transcribed from the model); each feature now declares `processes:[P#]` and DERIVES
> `dependsOn.drivers` (can't drift, like `modifies`). Overlays → `habitability` (cityLights/
> ecumenopolis/machine; bioMats); carbon → D10. Guard test rewritten (was Claim-8 skip) → 36 green.
> (2) **per-feature quality pass — IN PROGRESS** (Max picked: reuse the campaign per-feature UAT
> loop, spec §13; start = triage the Tier-2 109-false/85-dead punch-list, worst offenders first).
> **Triage round 1 LANDED 2026-06-14 (lab html only, verified :9223, 36 green):** the dominant
> false-render cluster (machine/ecumenopolis/cityLights/bioMats painting gas giants etc., ~52 of
> 92 solid) was ungated — coverage was a pure lab knob, never × the preset's D15 habitability,
> AND all 4 (+ hexTess/shatter exotic geometry) defaulted ON, so EVERY default view was a
> "blue-checkerboard city-world" (Max's report). Fix: (a) **default-OFF** machine/city/ecu/bio +
> hexTess/shatter (opt-in toggles; clean natural baseline); (b) **habitability gate** — `applyDrivers`
> stores `state.habGate = smoothstep(0.1,0.4, preset.habitability)`, the 4 overlay writers ×= it,
> so coverage→0 on hab≤0.05 worlds (gas giants/lava/frozen/europa/titan/venus/mars/magma/carbon/
> crystal) even when force-enabled. Verified: Jovian force-all-overlays-on → clean bands+GRS;
> Rocky → ecu paints. **DECISION PENDING (Max):** the hab gate also zeroes Venus(0)/Mars(0.05) —
> in some overlays' declared `rendersOn` — and can't tell Mars from Titan (both 0.05); if Max wants
> colonies on Mars/Venus the right gate is archetype-membership, not habitability. **Remaining
> triage:** hexTess/shatter still leak if force-enabled (need archetype gate); surface-relief cluster
> (mountains/dust/lava/frost/glacial on wrong presets, ~20); prune manifest rendersOn to match the gate.
>
> **▶ SESSION 2026-06-15 (orange-belt + surface-relief triage, handed off mid-stream):**
> (1) **F35 terminator "orange belt" FIXED** (`c4b46cf`, VERIFIED_PENDING_MAX) — Max-reported orange
> band on every planet type was F35 terminator-gradient strength flat 0.5 × saturated hue → swamped
> surface. Dropped to 0.15 (width ramp untouched). Live-verified Rocky+Venus. Tunable via live sliders.
> (2) **Relief triage — research + Bucket A SHIPPED** (`be989f4`, VERIFIED_PENDING_MAX, 36 green).
> 7 research subagents grounded each surface-relief false-render in planetary science → **~half were
> the MANIFEST being too narrow, not driver bugs.** Bucket A broadened rendersOn+archetypes: frost/
> glacial/sublimation+Europa, mountains+Lava (Io), lava/edifices+Venus, craters/ejecta+Mars/Rocky/
> Eyeball, massWasting blanket-all-solid. Verdict table: `docs/FEATURES/relief-triage-verdicts-2026-06-15.md`.
> (3) **Bucket B (driver tightening) — SHIPPED 2026-06-15** (`5ef6ca9`, VERIFIED_PENDING_MAX, 173 green).
> Density-based `rockyCrust` gate (smoothstep 2.5→3.9 g/cm³) on the silicate-relief family
> (mountains/lava/edifices/tessera) kills it on icy worlds (Europa/Titan/Frozen) while keeping
> Io-grade Lava/Magma/Venus/Rocky/Ocean/Mars; `_noSurface` gate zeros dust on the 5 h2-he giants;
> `_opaqueHaze` gate kills weatherBands on Titan. Numeric sweep (17 presets) + Europa visual confirm.
> Render-audit **refreshed** (`248b355`): false-renders 109→64, dead 85→51; targeted leaks all cleared.
> Residuals (Carbon/Crystal mountains (exotic), faint craters on Ocean/Europa) + remaining solid cluster
> = shatter/hexTess (exotics on non-exotic worlds) → **IN THIS WORKSTREAM (Max, 2026-06-15): finish the
> render-correctness residuals as part of the per-feature quality pass BEFORE integration**, not parked.
> **All Bucket-A/B commits PUSHED to origin/master.**
> (4) **Max's bigger ask = MENU/INFO OVERHAUL** (his goal #3), 4 phases. **Phase 1 (declutter)
> SHIPPED 2026-06-15 — VERIFIED_PENDING_MAX `fc30eb1`** (3 commits `6214510`/`3424ef7`/`fc30eb1`,
> GUI-only in planet-lod-lab.html, no shader/core change; full vitest delta = 0 new failures vs the
> pre-existing 17-file baseline; live-verified on :9223). Three moves landed: (a) top-of-left **World**
> folder consolidating the preset picker + derived archetype label + filter/solo (kills the
> selector-vs-indicator dup); (b) dedicated **bioMats(F46)/cityLights(F48)** right-panel folders (sliders
> moved out of shared Envelope; `cityLightsEnabled` literal preserved); (c) `applyArchetypeFilter()`
> now **reparents** feature folders — relevant → their category in declaration order, irrelevant → one
> collapsed **"Not relevant to this world (N)"** group (filter ON default; force-enable still 1 click away).
> Spec/plan: `docs/superpowers/{specs,plans}/2026-06-15-lod-lab-menu-declutter*`. **Remaining in the
> per-feature quality pass (all BEFORE integration):** info-layer asks 2–4 (per-feature info cards →
> archetype info view → live render-audit surfacing, each its own brainstorm→spec→plan) + the
> render-correctness residuals folded in from (3) above (Carbon/Crystal mountains, faint craters
> Ocean/Europa, shatter/hexTess exotic leak). Substrate: `relevantFeatureSet()`/`applyArchetypeFilter()`.
> **Commits `6214510`/`3424ef7`/`fc30eb1`/`9aebb53`/`b198057` are LOCAL — push pending Max + his UAT.**
> Planning handoff for the remaining asks: `/tmp/handoff-lod-menu-overhaul-PLANNING-NEXT-2026-06-15.md`.
> (5) **Parking-lot:** "outpost worlds" feature idea (Mars/Venus-type sparse nightside outpost lights,
> distinct from ecumenopolis/cities) — capture as a NEW campaign feature (dossier card + heavy loop), NOT inline.
> (6) **PLANNING SESSION 2026-06-15 (cont.) — all 4 remaining quality-pass items SPEC'd + PLANNED, ready for
> Max to greenlight execution (each brainstormed→spec→plan w/ Max; specs/plans LOCAL, UNPUSHED):**
> - **Ask 2 — per-feature info cards** (rich card derived from planet-visual-features.md at build time via a
>   generator + drift guard; inline ⓘ in each feature folder). spec `73bb42d`, plan `fef95fe`.
>   **SHIPPED 2026-06-15 — VERIFIED_PENDING_MAX `b30f811`** (6 commits `ec9f0f4`→`261ca9d`, LOCAL/unpushed):
>   generator `scripts/gen-feature-cards.mjs` + `planet-feature-cards.generated.js` (46/47 cards; clouds(F31)
>   structured-only); unit test pins parser+F#→key join; `npm run gen-feature-cards`; inline ⓘ card per feature
>   folder (prose+driven/renders/state, plain DOM, no core/shader change); doc-rot drift guard (also fixed a
>   pre-existing Check-7 `set -e` abort). Live-verified on :9223 (all 5 spec criteria + multi-open). 3 plan-pinned
>   suites green (planet-archetypes incl. cityLights pin, feature-associations, gen-feature-cards); pre-existing
>   17-file vitest baseline unchanged. Asks 3–4 + Thread B remain.
> - **Ask 3 — archetype info view** (inline ⓘ on the World-folder archetype label; runtime-derived roster of
>   what the world should exhibit + per-feature state; no generator). spec `abf3d56`+`e4bff7f`, plan `002b033`.
>   **SHIPPED 2026-06-15 — VERIFIED_PENDING_MAX `a6b4950`** (3 commits `a44a762`→`a6b4950`, LOCAL/unpushed):
>   `archetypeInfoHtml()` renderer + `.archetype-info` CSS (Task 1); ⓘ on the disabled archetype field row +
>   plain-DOM block injected under it, collapsed by default (Task 2); live-update — enable toggle refreshes
>   dots+K, preset change re-derives via `applyArchetypeFilter()` tail hook (Task 3). Plain DOM, no
>   core/shader change → cannot regress rendering. Reconciled cleanly with Ask 2 (merged single-slot
>   onChange so card-State AND archetype-info both refresh; reused existing `escapeHtml`/`.title-info`). Lab
>   *tooling*, not a game feature (charter: lab≠game). Live-verified on :9223 (all 5 spec criteria: Venus
>   2-arch/mountains-under-both/M-counts-once, Gas-giant 1-arch, toggle flips dot+K w/ N/M held, preset
>   re-derive matches label, collapsed-default); Ask 2 card-State non-regression confirmed (●↔○ flips). 2
>   plan-pinned suites green (planet-archetypes incl. cityLights pin #16, feature-associations); pre-existing
>   17-file vitest baseline unchanged. Ask 4 + Thread B remain.
> - **Thread B — render-correctness residuals** (per-feature relevance hard-gate for shatter/hexTess + targeted
>   Carbon/Crystal knockdown for mountains; carbon/facets already honest; faint Ocean/Europa craters ACCEPTED
>   doc-only; lab-level only, ZERO core touches; gets Max UAT). spec `09ff72a`→`e339b9f`, plan `473ac8d`.
>   **SHIPPED 2026-06-15 — VERIFIED_PENDING_MAX `27d8b8e`** (4 commits `340e2ae`→`ccbdaf5`, LOCAL/unpushed):
>   `applyDrivers()` derives `state.featureRelevant.{shatter,hexTess}` from `ASSOCIATIONS[key].rendersOn` (honors
>   hexTess's `rendersOnDivergent` Frozen membership — the raw `relevantFeatureSet().set` does NOT) +
>   `state.isExoticCarbonOrGeometric`, both 1.0/0.0 (habGate idiom); three one-line `×=` writer multiplies
>   (`uShatStrength`/`uHexStrength` × relevance, `uMountainAmp` × `(1−exoticCG)`). Lab-level only, NO core/shader
>   change, NO manifest edit. Lab *tooling* (charter: lab≠game). Live-verified on :9223 via direct uniform probe
>   (writer outputs): Rocky force-enable shat/hex → `uShat=uHex=0` (gate beats enable); Frozen member → `=1`
>   (byte-identical); Carbon/Crystal `uMountainAmp=0` while derivedAmp>0; Rocky `uMountainAmp=0.46=derivedAmp`
>   (member unchanged). Europa mountains-preview asymmetry held. D2 canary `frozen.hexRel===1`. 2 plan-pinned
>   suites green (feature-associations incl. rendersOn⊆archetype-union+divergent exemption — proves no manifest
>   drift; planet-archetypes incl. cityLights pin #16); pre-existing 17-file vitest baseline unchanged.
>   **Render-audit Δ re-run NOT used (CONCERN):** a fresh `?fresh=1` sweep measures at ~60–100× smaller pixel-
>   fraction scale than the committed `248b355` sweep (untouched features clouds/canyons/craters collapsed
>   identically) → not apples-to-apples; the committed report (`248b355`, 64/51) was left as-is. The uniform-level
>   live probe is the integration proof instead. Ask 4 should re-baseline the audit under a captured sweep config.
>   Max UAT remains.
> - **Ask 4 — live render-audit surfacing** ("Audit this world" button → live current-preset sweep → existing
>   pure auditor → per-feature glyph badges + World summary; auto-stale-on-edit; shared EPS/STRONG via new
>   pure lab-render-status.js imported by lab AND gen-render-audit.mjs). spec `5c20886`→`dd733ce`, plan `d3282de`.
>   **SHIPPED 2026-06-15 — VERIFIED_PENDING_MAX `5679e8d`** (6 commits `a22a1fc`→`5679e8d`, LOCAL/unpushed):
>   pure `lab-render-status.js` (`statusOf` + EPS=1e-4/STRONG=5e-4, ⬛-degen-wins, 10-assert unit test);
>   `gen-render-audit.mjs` imports those consts → report re-gens byte-identical (64/51, `git diff --exit-code`
>   clean); lab `runAudit()` runs `renderDeltaSweep()` for current preset, classifies 47 features (eps passed
>   EXPLICITLY — not the 0.01 default), writes `state.audit`; World-folder button + summary ("N false · M dead ·
>   ✓ fresh|⚠ stale"); plain-DOM glyph badge per feature title bar; two global `gui.onChange` hooks auto-stale on
>   any edit, guarded by `_auditing` so the sweep can't self-stale. **NO core/shader change** (`planet-lod-lab-core.js`
>   untouched; `git diff ba972d5..HEAD` = 4 files only). Lab *tooling* (charter: lab≠game — no Max-UAT gate required,
>   but live :9223 verify mandatory + done). Live-verified on :9223 (state/DOM, not images): self-stale guard
>   (`fresh===true` right after audit), badges===state cell-for-cell, stale-on-edit + re-audit-restores-fresh +
>   preset-switch-stales (via real dropdown), `machine`-on-Ocean force-irrelevant → `🔴F` (delta 0.0053). Cross-check
>   vs committed report: strong-signal home-preset cells agree (Rocky 9/10); `shatter`/`hexTess` Venus 🔴F→· =
>   EXPECTED Thread-B fix showing through (delta exactly 0); eps-knife-edge faint features diverge per the known
>   fresh-sweep scale issue (same as Thread B's CONCERN above), NOT an eps bug (canyons@1.3e-4→✅ proves eps=1e-4
>   reaches statusOf). 4 plan-pinned suites green (render-status, render-audit, feature-associations,
>   planet-archetypes incl. cityLights pin); pre-existing 17-file galaxy/vendor baseline unchanged. Max UAT optional.
> Recommended execution order (Max's earlier pick): **Ask 2 → Ask 3 → Thread B → Ask 4** (Ask 4 last so the
> surfaced audit reflects Thread B's fixes; Asks 2/3/4 are GUI-independent of each other and of Thread B).
> Execution-ready handoff: `/tmp/handoff-lod-quality-pass-EXECUTE-READY-2026-06-15.md`. **Still pending: Max UAT
> of Phase-1 declutter + push authorization for ALL local commits (declutter + these 8 spec/plan docs).**
>
> **▶ SESSION 2026-06-15 (cont. — audit re-baseline + F38 airglow; both PUSHED `369ec02..35efaa7`):**
> (1) **Render-audit re-baseline — DONE `b0e980f`.** Root-caused the fresh-sweep-vs-committed scale
> mismatch (the prior session's CONCERN): `renderDeltaSweep()` measures `changedPixels/frameTotal`, which
> scales with planet coverage (∝1/distance²), and never pinned `state.distance` — the committed
> `.sweep-raw.json` was captured at distance≈**2.6**, fresh sweeps at default 20 read ~64–100× smaller.
> Fix: pinned `SWEEP_DISTANCE=2.6` (save/restore) inside `renderDeltaSweep()` → offline report AND live
> Ask-4 badges now capture at one scale by construction. Re-baselined raw+report: **dead 51=51, false
> 64→40** (the −24 = Thread B's hexTess/shatter + mountains×Carbon/Crystal finally clearing to `·`); live
> badges == offline report 0/94. Lab tooling, no core touch.
> (2) **F38 airglow BUILT — VERIFIED_PENDING_MAX `35efaa7`** (campaign Phase-4c heavy loop, full
> card→implement→review→live-A/B, all subagent-driven). Thin uniform night-limb emissive band, all
> latitudes (not polar), airglow-green, emissive-bypass channel, gated on atmosphere (not field); distinct
> from F37/F34/F33. Card `docs/FEATURES/cards/F38-airglow.md` (§7 verdict + 3 taste-forks for Max's lap).
> Code-review fixes: Mars+Titan→rendersOn (real airglow, in archetype union), floor 0.30→0.12 (honest
> density ramp Venus 0.70>Earth 0.40>Mars 0.12; airless=0). 8/8 ACs green live; enforced suites 36/36; no
> core touch. **Pending Max: F38 UAT + its taste-forks.**
> (3) **F39 cloud-optics BUILT — VERIFIED_PENDING_MAX `9fb6f6c`** (campaign Phase-4c heavy loop, Max out of
> loop; full card→implement→code-review APPROVE→live-A/B, all subagent-driven). Backscatter GLORY: discrete
> 2–3 colour-banded concentric rings at the antisolar point (`dot(V,uLightDir)≈1`) on the LIT cloud deck,
> riding the F31 deck (dependsOn/isolationKit clouds; `solo('cloudOptics')` re-enables the deck — F36
> sunglint→lakes precedent). Flagged the WORST envelope-fit + a strong park candidate — it **beat the
> envelope** by leaning INTO discreteness (3 hard floor() colour-step bands on the emissive-bypass channel,
> never double-quantized). Carriers terrestrial/ocean/venus (Venus brightest). Live A/B (GPU :9223, objective
> pixel reads): all 8 ACs green — antisolar 3-band read at d15, distinct hues survive the envelope, cloud +
> dayside gates clean, off⇒vec3(0) deterministic, Venus brightest, antisolar-locked (vanishes 25° off-axis).
> `PROV_CLOUDOPTICS=47`; enforced suites 36/36; backtick parity even; NO core touch. Card
> `docs/FEATURES/cards/F39-cloud-optics.md` (§7 verdict + 3 taste-forks for Max's lap: d4/bright-Venus
> inner-blue clip→2-band read, stylized-large uGloryRadius=0.06, rainbow-42°-arc cut to v1). **Max UAT
> verdict (2026-06-15): DISABLED BY DEFAULT — taste-call** (read as a "bullseye"; too hi-fidelity for the
> lo-fi aesthetic). `cloudOpticsEnabled` default flipped true→false (opt-in via GUI, like city-lights/machine
> after Phase-1 declutter); code/registry/verification all retained, parked-as-built. **Commits `9fb6f6c` +
> `235fc53` PUSHED** (`52e3e7b..235fc53`).
> (4) **BUILD CAMPAIGN COMPLETE** — F38+F39 were the last two unbuilt features; Phase 4c build is done. **Next
> phase = finish the render-correctness residuals BEFORE Integration (Phase 5).** Max's chosen next-session
> plan (2026-06-15): **(Step 1)** run the systematic render-correctness audit via the "Audit this world" tool
> (Ask 4) → full residual punch-list → triage manifest-wrong vs feature-buggy → fix the clear bugs in the lab,
> surface taste-y ones to Max; **(Step 2)** then a guided tour of the menu/info tooling (Asks 2/3/4) for Max's
> UAT. Handoff (full project frame): **`/tmp/handoff-lod-render-correctness-audit-2026-06-15.md`**.
> **⚠ Known artifact Max spotted (queued for Step 1):** F34 limb glow renders "two rings OUTSIDE the planet" =
> the F31e companion shell (detached double-arc ~1.15R on Titan/Venus/Sub-Neptune). Root-caused + fix-options
> logged in `docs/FEATURES/cards/F34-limb-glow.md` §7 — it's a taste call (retune/gate/disable the shell).
> (5) **Still pending Max UAT (carried):** F38 airglow + its 3 taste-forks; Phase-1 declutter + Thread B + Asks
> 2/3/4 (the menu/info tooling — covered by Step 2's tour).
>
> **▶ SESSION 2026-06-15 (cont. — render-correctness TERRAIN punch-list CLEARED, 40→18):** Triaged the audit's
> 40 false-renders; the terrain cluster was mostly the manifest being too narrow, not driver bugs. **5 commits,
> master, LOCAL/unpushed, all uniform+live verified on :9223, NO core touch, 36/36 gate:** `fd45f36` manifest
> broadenings (edifices/sublimation/glacial/frost/machine + canyons/scarps/plateaus+Lava; technogenic archetype
> broadened, kept distinct from F48/F49); `8937387` **craters driven by climate/age** (one `_craterWeathering`
> from atmosphere-pressure+erosion+resurfacing → density/amp/relaxation; Frozen sharp/numerous ↔ Rocky/Venus
> eroded — first instance of Max's recurring ask = a SYSTEM for per-planet-type variable tuning); `e2d167a`
> relief writers hard-gated to rendersOn (Thread B `featureRelevant` idiom → mountains/scarps/plateaus/canyons/
> tessera, icy+exotic leaks → 0); `33a253f` crater/ejecta residual (broaden natural-solid, gate exotic Carbon/
> Crystal); `73a8d5f` **re-baseline** (fresh 17-preset GPU sweep → false 40→18, dead 51→54, degen 0). Holistic
> live confirm on the 3 worst worlds (Europa/Magma/Crystal): terrain leaks gone, only legit members render.
> **Remaining 18 are a NEW smaller set** the fresh sweep surfaced (now 49 features vs 45): 11× airglow/cloudOptics
> on giants/SubN (= F38/F39 UAT; cloudOptics default-OFF), faint Mars leaks (glacial/machine/polarVortex ~0.005),
> lightning@Titan (low-conf, don't chase). **Next session (Max drives, tour-first):** STEP 1 info-tooling tour
> (Asks 2/3/4 UAT on :9223) → STEP 2 second cleanup round on the 18 (+ glacial@Mars quick broaden). Full frame +
> standing cautions: **`/tmp/handoff-lod-tour-and-cleanup-2026-06-15.md`**. All today's commits + prior info-tool
> backlog = LOCAL/unpushed, push pending Max.

> **▶ SESSION 2026-06-15 (cont. — F38/F39 taste-calls + STEP-2 cleanup DONE, both PUSHED; new backlog parked):**
> Gathered Max's F38/F39 taste-calls, then cleared STEP 2 (the 18 false-renders → **2**). **`6d4b2fa` (pushed):**
> Thread-B `featureRelevant` gate extended to airglow (off gas-giants/SubN — green OI is terrestrial; giants'
> airglow is UV, unmodeled), cloudOptics (→ declared Rocky/Ocean/Venus only; dormant, default-OFF), machine@Mars
> + polarVortex@Mars (off — enforce declared intent); glacial broadened rendersOn += Mars (real lobate-debris
> glaciers; ⊆-union held). 16 fixed + verified (uniform reads, exact 0; 36/36 gate; backtick parity 122). Full
> re-baseline sweep: false 18→2 = lightning@Titan (deliberate don't-chase) + magma@Ocean (**sweep artifact** —
> re-measures 0.0, a Lava→Ocean transition state-bleed, zero magma code touched); dead 54→63 = floor-flicker on
> already-declared presets, not these edits. **`64474f9` (pushed):** F38 card §7 UAT verdict — (a) Mars/Titan KEEP,
> (b) faint-Mars 0.12 ACCEPTED (Max live: "looks good", intended-subtle), (c) flat green KEEP. Ask-4 "Audit this
> world" demoed — Max confirmed **0-false** on Rocky/Ocean/Neptune. **Tour (STEP 1) + cleanup (STEP 2) both
> complete.** ⭐ **NEW: Max parked a 14-item lab visual-quality backlog → `docs/FEATURES/lod-lab-quality-backlog.md`
> (his words, untriaged).** Next session OPENS with the **order-of-attack** decision (Claude flagged 2 candidate
> roots: a shared cell/Worley-noise primitive misapplied across rivers/sublimation/lava/crystal/ecumenopolis/
> canyons; + feature-scale-vs-planet-radius normalization). Handoff: **`/tmp/handoff-lod-step2-done-backlog-parked-2026-06-15.md`**.

Last updated: 2026-06-10 by working-Claude (flash session: **Max's entry flash FIXED `4278037`, VERIFIED_PENDING_MAX.** Root cause was NONE of the handoff's 4 candidates — it predates the swap: `updateTraversal` ran in simStep (60Hz) while the rendered camera interpolates per render frame (240Hz), so the camera crossed Portal A's plane up to ~4 rendered frames before the mode flipped; those frames drew stencil-ON with the disc behind the camera → empty stencil mask → tunnel invisible → ~3 frames (~12ms) of raw origin sky. Proven by in-page per-frame canvas capture frame-aligned with signed plane distance (sky-bright frames == sd<0 ∧ OUTSIDE_A exactly, 2 pre-fix warps). Fix: detection moved to renderFrame after camera interpolation. Post-fix: 3 warps, 0 stale frames (was 3/warp), flat crossing brightness, no AC4/AC10 warnings. Headless 54/54. Prior session's 3 goals all VERIFIED_PENDING_MAX `c85480f`. TEMP `__swapTiming` instrumentation still in main.js — remove before workstream ships. **Pushed + Pages deploy green 2026-06-10. Flash fix UAT-PASSED, belts CONFIRMED, far-opening residual CONFIRMED FINE — Max, post-fix ride. All 3 goals + flash SHIPPED.** Next (Max, 2026-06-10): arrival distance — exit farther from system center so star(s) show as billboards on emergence, consistent with the starfield-version of the star seen from the origin system when warping via starfield targeting (vs nav comp). **ARRIVAL-DISTANCE IMPLEMENTED same day (`4afd58e` `29405f5` `04d3437`, master, unpushed): orbitDist now derived from new `StarFlare.billboardSwitchDistance()` × 1.3 (knob `window._warpArrivalMargin`), both warp paths, binaries take max+sep. Spec/plan in docs/superpowers/{specs,plans}/2026-06-10-warp-arrival-billboard-distance*. 6/6 unit tests; subagent spec+quality reviews clean. **Live verify (Task 3) COMPLETE — ARRIVAL-DISTANCE VERIFIED_PENDING_MAX `04d3437`.** 5 controlled warps all-state-tools (no screenshots, game muted per Max's directives): warp 1 full PASS (prior session), warp 3 starfield emergence PASS w/ in-eval center-raycast + >100px mesh sweep (only sky-dome scenery; NO giant flare — §3 anomaly did NOT reproduce at 2 instrumented emergences, CLOSED as runaway-tour scenery), LOD crossover observed BOTH directions (disc 3186–3408 / billboard ≥3631, brackets switchDist ≈ emergence/1.3), nav-comp path PASS via real AutopilotNavSequence (overlay→commit→dispatch→arrival), binary (M+M, seed 175217743) BOTH stars `bbVis=true, discVis=false` at emergence incl. the dim-companion +sep worst case, large-orbitDist arrival ~4.9k units clean. Note: dist-at-idle-detection jitters around orbitDist (coast before / fly-in after the idle flip) — invariant is billboard-range emergence, held every observation. Console: only the known pre-existing travel-telemetry oscillation warning; no AC4/AC5. Fresh: 6/6 unit, build clean. Seed-targeted nav-data warps work from console (replicate `_setWarpTargetFromNavStar` field writes on `window._warpTarget` + `_beginWarpTurn`). **Max UAT next: ride starfield + nav-comp warp, tune `window._warpArrivalMargin` (default 1.3, read per-warp) — confirmed value gets baked. Then remove TEMP `__swapTiming` + push on Max's word.**

---

## Active workstream

> **▶ WORLD-ENGINE HISTORY PROGRAM — GROUND track, increment #4a (volcanic/magmatism) — `VERIFIED_PENDING_MAX eb18666` (2026-06-30).**
> New `src/worldengine/base/magmatism.js` (`writeMagmatismSphere`): one seeded mantle-plume field → shield edifices + lava-plain flooding + a T_ss-scaled substellar magma basin (F41 iso-angle law); `writeBodyRelief` now 4-way plate→shell→volcanic→despun (plate+shell paths byte-identical). **Live AC10 driven + PASS** (Lava & Magma, seed 1234): heightSource=carrier, regime=volcanic, plume-variance crushes latitude (0.74/0.76 vs 0.0003/0.0001), edifice>plain>basin ordering holds, Magma basin (1.52 rad) strictly wider than Lava (0.42 rad). Headless: 19 files/196 + magma structure 28/28. Artifacts: `docs/WORKSTREAMS/world-engine-magmatism-2026-06-30/` (contract + intent + SLICE-B-mechanism-math + **verdict.json**). **NEXT = Max AC11 UAT** (does Lava/Magma read as distinct volcanic worlds). ⚠ UAT gotcha: the seed-derived magma-basin axis is ~opposite the lab's fixed sun, so the basin defaults to the NIGHT side — a new adjustable world-light control (`_lab.setLightDir(az,el)` + GUI) lets Max rotate the sun onto it. Program SoT: memory `[[well-dipper-world-engine-program]]` + newest `/tmp/handoff-world-engine-*.md`. (#1 shell-relief + #2 plate-driver already VERIFIED_PENDING_MAX/SHIPPED; the WS1/WS2 block below is the 2026-06-24/25 base-step history, kept as record.)
> **#4a UAT (2026-07-01) → next = #4-MULTIPLY.** Max UAT'd: structure right, look reads "crude/too regular" (circular analytic domes; "one giant + arbitrary sizes"). Root-caused vs the spine (naturalism accretes from later causal layers, not cosmetic noise). Recorded 2 un-owned gaps (`816800b`): new ROADMAP increment **#4-MULTIPLY** (E7 driver-response + grain-aligned asymmetry, mirroring #2) + a #7 volcanic-terrain note + "circular dome = skeleton not final" deferrals in the #4a docs. Also shipped an adjustable lab **world-light control** (`a21270f`, Max's request — the seed-placed Magma basin defaults to the night side). **NEXT (fresh session, via workflows): build #4-MULTIPLY** (design skeleton is in the ROADMAP note; mirror #2's byte-identical-at-neutral-ref discipline). Max's #4a AC11 UAT (accept-as-skeleton → ship) is his parallel gate. Handoff: `/tmp/handoff-world-engine-4multiply-2026-07-01.md`.

**`world-engine` PRODUCTION-L1 PORT — WS1 (L0 plumbing) BUILT + ✅ VERIFIED 2026-06-24
(`05bf668`, branch `feature/world-engine-production-L1`; `master` preserved at `25fe51c`; push HOLD).
→ WS2 (Tier-1 base step) ✅ SHIPPED 2026-06-25 (Max UAT-passed; `b71d3ec`). NEXT (fresh session): WS3 (type-demotion) ∥ WS4 (wire E6→E9) — see the WS2 bullet below.**
First of 4 production-L1 workstreams (lab-only scope locked by Max 2026-06-23; campaign plan
`docs/FEATURES/world-engine-production-L1-plan.md`). WS1 is STRICTLY ADDITIVE: surfaces six real L0
drivers on per-body `planetData` — `age`, `metallicity`, `magneticField` (single-source dynamo),
`eccentricity` (was dead code; data-only; dedicated rng → zero shared-stream draws), `tidalHeating`
(real for moons+planets; surfaced-only, NOT wired into rendering), `systemContext` (flat,
serialization-safe) — with ZERO behavioral change (frozen 23-key additive gate held byte-identical).
Built last session via subagent-driven TDD (7 tasks); contract+intent
`docs/WORKSTREAMS/world-engine-l0-plumbing-2026-06-23/`.
- **This session (2026-06-24): workflow audit → fix → re-verify.** A 6-dimension adversarial audit
  (each finding 3-lens verified) cleared the additive invariant but surfaced ONE real correctness
  defect: `systemContext.resonancePartners` resolved resonance pairs via PRE-cull indices against the
  POST-cull `planets` array → wrong partner/ratio (and dropped culled pairs) in binary+resonant+culled
  systems. Fixed via TDD (object-identity partner resolution; trigger seed `scan-2606`, RED→GREEN,
  independently reproduced; live GPU-runtime confirmed on `:5173`, fps 242). Plus 5 test/comment
  hardening items (AC1 generated-planet tidalHeating pin; moon frozen-baseline additive gate;
  exact-equality assertions; eccSeed comment; nit comment). Committed `05bf668`.
- **✅ verify-workstream at `05bf668`: all 6 ACs PASS** (5 integration + 1 unit, all headless/live=false),
  3/3 adversarial each; additive-gate golden independently confirmed untouched; `uat = N/A` (no UAT AC)
  → WS1 DONE. WS1 suite 33/33; the 4 broader-cluster failures are pre-existing `searchKnownObjects`, untouched.
- **▶ WS2 (Tier-1 base step) — ✅ SHIPPED 2026-06-25 (Max UAT-passed; `b71d3ec`, local-only, NOT pushed).**
  `docs/WORKSTREAMS/world-engine-base-step-2026-06-24/` (intent.md + contract.json [16 ACs] + scoping-dossier.md
  + **verdict.json**). NEW three-free `src/worldengine/base/` tree (8 modules: substrate, mathutil, adaptL0,
  baseStep, tectonic, sphereField, verify, fieldViz) ports the proven `relief-*` formulas; `src/generation/` +
  `relief-*` + `Planet.js` byte-untouched (Option A). Plan `docs/superpowers/plans/2026-06-24-world-engine-base-step.md`.
  Built via: grounding workflow (7 extractors+critic, verbatim code) → plan → **5-critic adversarial plan pass**
  (caught 4 blockers PRE-code: the stress-band-constant cluster — true 38.33/57.69 boundaries + 45° grain flip +
  1.5° seam tol) → **sequential subagent implement→review→fix per task** (11 commits).
  **Gate — verify-workstream (`wf_fbd25257-ca1`, full, 3× adversarial) + targeted F7 re-verify (`wf_e4fab211-129`):
  15/16 ACs PASS, 1 deferred-to-max (AC-VIZ-distinct).** WS2 suite 47/47; lab reference 63/63 (no regression);
  no three.js/Math.random/Date.now in the base tree. F3 reuses the router's `buildIrregularSphere` via a plain-mesh
  DI (three lives only in the test). One gate-caught gap closed: the F7 fixture set now threads the **F2-adapter
  output** (not just the 5 presets) through the determinism+verifier gate.
  **✅ Max UAT (2026-06-25):** each preset reads categorically distinct → AC-VIZ-distinct PASS (16/16 ACs). Two
  deliberate behaviors documented in `KNOWN-BEHAVIORS.md`: (1) same-class worlds share a byte-identical
  `crustalThickness` layout (lava≡magma `-1:sil`, rocky≡terrestrial `1:sil`; 0/16384 cells differ) — regime/grain
  still differ (4608/16384), Max accepted; (2) tidal Io-anchor `TIDAL_LOG_KNEE=1.6` (Io~0.19) confirmed — retune is
  a one-constant change. Both flagged inline in `adaptL0.js` + `baseStep.js`.
  **▶ NEXT (fresh session, Max's seam): WS3 (type→label demotion) ∥ WS4 (wire E6→E9 into the renderer)** — WS4 is
  where the FULL "planet reads as a landscape with a history" UAT lands. Campaign plan `world-engine-production-L1-plan.md`.
- **Open (Max's):** push (HOLD, campaign-wide); whether to merge `feature/world-engine-production-L1`
  → `master` after WS1 (merging triggers the master-only Pages deploy — rec: keep accumulating WS2–4 first).

---

**`world-engine` relief-group slice — BUILT (isolated harness), ✅ Max UAT-PASSED 2026-06-23
(`90b66f7`). Push: HOLD (Max). Branch plan: preserve `master` as-is; production-L1 integration
goes on a DEDICATED branch (this slice is isolated/additive — safe on master as a checkpoint).**
First vertical slice of the co-genesis
**"world-engine" L1 layer** for the planet-LOD lab: the RELIEF GROUP — E6 tectonic
*builds* relief → E9 hydrology *carves* drainage, over 2 epochs sharing ONE mutable
height substrate, fed by a minimal base step. Built in an **isolated harness — NOT
wired into the game or the main planet-lod-lab.** Objective gate is GREEN: **33/33
vitest pass**; the north-star verifier `verifyReliefSlice` returns `pass=true` on
rocky/lava/europa presets across seeds; live GPU (RTX 5080, chrome-devtools `:5173`)
A/B confirmed — epoch-2 OFF shows uncut tectonic relief, epoch-2 ON shows a dendritic
drainage network carved into the SAME relief (`screenshots/relief-slice-A-epoch2-off-uncut.png`,
`screenshots/relief-slice-B-epoch2-on-carved.png`). Validates the 4 wf2-synthesis §9
items: shared-relief-substrate pattern, host-editor/epoch model end-to-end, expose+derive
(Option A) boundary, E9 bake feasibility.
- **New files (all committed at repo root):** `relief-substrate.js`, `relief-base-step.js`,
  `relief-presets.js`, `relief-e6-tectonic.js`, `relief-e9-hydrology.js`, `relief-slice.js`,
  `world-engine-relief-lab.html`, `world-engine-relief-lab.main.js`,
  `tests/world-engine-relief-slice.test.js`.
- **Plan (10 TDD tasks):** `docs/FEATURES/world-engine-relief-slice-plan.md`.
- **Master pickup index:** `docs/FEATURES/world-engine-INDEX.md` (read it first).
- **⚠ SCOPE CAVEATS (do not overclaim):** UAT — "does it read as a landscape with a
  history" — was **MAX'S GATE ALONE** and is now **✅ PASSED (2026-06-23)**; the slice is proven
  in the lab but **NOT pushed and NOT wired into production** (a separate, large effort). Flat 2D
  latitude-band DEM (NOT sphere/cubemap — sphere mapping is deferred
  integration; cubemap-seam lake breakage is a known later hazard). E9 is a CPU bake-time
  reference (GPU FastFlow/Jain-2024 bake deferred). D12 stubbed/derived in the slice's own
  base step (NO edit to the production `PlanetGenerator.js:565` hard-zero). Hack's-law
  exponent (~0.41–0.45) is REPORTED as a quality metric, NOT a pass-gate signal; the gate is
  the 5 resolution-robust core signals (subtractive, carve-correlates-relief, no-uphill,
  depressions-filled, accumulation-spread).
- **▶ NEXT:** Max UAT on the live harness (`world-engine-relief-lab.html`, GPU). If it reads
  right, scope the production **L1 layer** via `dev-collab-scope`.
- **Maps to journey:** the deferred "Phase 2" L1 generative layer the LOD-lab charter names —
  upstream of rendering so features express a shared history, not a bag of toggled effects.

**▶ RELIEF BODY-TYPE DIVERGENCE BUILD — DONE, objective gate GREEN → `VERIFIED_PENDING_MAX`
(harness commit this session; build pre-harness `842b649`). Push: HOLD.** Max's post-UAT ask:
the relief slice should produce **categorically different worlds per body type** (the prior slice
was AMPLITUDE-only by design). Built additively in the same isolated lab across 5 compounding
layers: **L1 regime** (un-damped strain sign flips the Anderson regime mix per body),
**L2 geometry** (regime/sign branches steeredNoise → across- vs along-strike relief),
**L3 seed** (a composition/regime discriminator folds into the crust seed → composition-keyed
LAYOUT; toggleable via `discriminate`), **L4 carve** (liquidStability gates ocean fraction +
fluvial carve — airless≈0, temperate-wet=full network), **L5 terrestrial** (a temperate
liquid-water bundle completing the wet/frozen/airless trio vs europa, lava).
- **DECISIVE GATE redefined → `divergenceReport` in `relief-slice.js`** (exported): a pair PASSES
  iff it diverges on ≥1 ROBUST, RESEED-INVARIANT axis — **regime | hydrology(|liquidStability|) |
  carve** (thresholds 0.2 / 0.3 / 0.05). Reseed-invariant by construction → a reshuffle of the
  same world cannot pass. **The spec's original "decisive gate = held-seed HYPSOMETRIC" did NOT
  hold up** — a 15-seed sweep showed cross-regime hypsometric is seed-fragile (6/15 fail at n=192),
  so hypsometric + directional anisotropy are now REPORTED to corroborate, NOT gated (Task 4.5
  EARLY-EXIT GO + Task 7 redefinition).
- **✅ DONE + Max UAT-PASSED 2026-06-23 (`ef63554`):** 63/63 vitest pass (`tests/world-engine-relief-slice.test.js`) + whole-branch review clean + live integration check (chrome-devtools `:5173`) + **Max UAT "they all read as distinct."**
- **Harness (this session, lab-only):** preset selector now offers `terrestrial` (auto from
  `Object.keys(PRESETS)`); HUD shows the current preset's drivers (dominant regime / liquidStability /
  anisotropy) every render (cheap — read off the current run), plus an **on-demand "divergence vs lava"
  button** that runs `divergenceReport` at n=128 (NOT per-frame). `window._relief.divergence(against,n)`
  exposes it for scripted live checks. **Renderer (buildMesh/displacement/coloring) stays PRESET-BLIND.**
- **New file:** `relief-divergence.js` (the measuring instrument: hypsometric / perCellRMS /
  regimeHistogram / directionalAnisotropy / carveFraction / channelFraction). Build-intent headers
  updated in `relief-slice.js` (non-goal flipped to "now realized"), `relief-presets.js`, `relief-divergence.js`.
- **Spec / plan / SDD:** `docs/superpowers/specs/2026-06-23-world-engine-body-divergence-design.md`,
  `docs/superpowers/plans/2026-06-23-world-engine-body-divergence.md`, task briefs+reports in `.superpowers/sdd/`.
- **▶ NEXT — UAT ✅ PASSED; build closed.** Live integration check done (3-world A/B + screenshots
  `screenshots/relief-divergence-{terrestrial,europa,lava}.png`), Max UAT passed. Open decision: **push**
  (still HOLD — Max's call). Then the production-L1 port: dedicated branch off `master` →
  `dev-collab-scope` the L1 layer (wiring engines into the real renderers + type-demotion refactor,
  high blast radius). Lab left clean on `terrestrial`.

### Prior active — supercruise (paused at a clean seam, pending UAT)

**`supercruise-freelook-2026-06-10`** — **AUTOPILOT HALF BUILT (Tasks 1–7 of 13),
paused at a clean seam 2026-06-10.** Elite-style supercruise is now THE in-system
mover for the **autopilot**: tour legs AND post-warp fly-in both fly the new
`SupercruiseModel` (one model, two drivers). Manual piloting / freelook / HUD /
old-mover retirement (Tasks 8–13) deferred to a fresh session.
Contract (9 ACs) + intent + plan:
`docs/WORKSTREAMS/supercruise-freelook-2026-06-10/` +
`docs/superpowers/plans/2026-06-10-supercruise-freelook.md`.
**Built + committed (all unit + live-verified on GPU :9223):**
- `src/flight/SupercruiseModel.js` — nose-vector flight, throttle, gravity-well
  speed cap (scale-free: `CAP_MIN_FRAC` 0.5 + `CAP_MIN_ABS` 1e-5 — production
  radii span 4e-5…5, two scale bugs found+fixed live), capped turn rate. 40 unit tests.
- `src/flight/HeadMount.js` — rotation-only head/ship split (hold-to-look, eased
  recenter); ready for Task 8/10 input wiring + the future cockpit (computed math,
  NOT Object3D parenting — WorldOrigin rebase constraint).
- `src/flight/SupercruisePilot.js` — ALIGN/CRUISE/HOLD autopilot driver issuing the
  SAME throttle/steer a player will; drop-window capture vs overshoot; HOLD settle ease.
- `src/main.js` — sc mover branch in simStep (drives `ShipChoreographer` for the
  AC6 shake beats); tour-leg + warp-fly-in cutover; `_seedScPoseFromCameraIfIdle()`
  helper; warp-path pilot stops; `window._sc` live-tuning probe.
- Commits: `53f4766 b09015d a258eeb 5b5dcfe f40f59c de78ab7 a710919 64a614a 51cd579 259f855 d5e4e2f 2fd8981 0dce7b3 ec0f932` (master, UNPUSHED).
**NOT yet built (Tasks 8–13):** manual W/S throttle + mouse virtual joystick + F→manual
takeover + manual drop (AC3); freelook input binding (AC4 live); minimal HUD
speed/throttle/reticle/target (AC7); COMMIT BURN cutover `focus*`→pilot, `focusShip`
quarantine (AC5c); retire AutopilotMotion + NavigationSubsystem from live path (AC8
loop + Task 12); full verify-workstream + Max UAT (AC9).
**Handoff:** `/tmp/well-dipper-supercruise-handoff-2026-06-10.md`.
**Maps to journey:** rebuilds the travel-loop foundation the 35% SCREENSAVER-MVP
autopilot rides; first GAME-tier (85%) capability lands with Tasks 8–10.
**⚠ Live tree note:** the screensaver autopilot now flies supercruise — if Max runs
the dev server before Tasks 8–13, the tour/warp loop works but manual F-mode still
routes to the legacy FlightDynamics drive (not yet rewired).

### Prior active — warp tunnel (pending-UAT items remain)

**`warp-tunnel-pocket-traversal-2026-06-06`** — **cruise-visual tuning.**
**Problem #2 (walls reverse halfway) FIXED `8bda388`, VERIFIED_PENDING_MAX.**
Root cause: two opposing wall-motion sources — the constant `uScroll += dt*0.5`
drift (static-camera lab holdover) vs real camera parallax; the AC5 dead-stop
park exposed the drift as a reversal. Per Max's decision (continuous flight):
drift removed; park is now a soft creep (`parkBackDepth()` in
`portalTraversal.js`, eases 20u→6u over min-cruise, entry-depth-capped so the
swap's shallow drop-in — measured ~14.7u live — can't re-freeze it). Live
telemetry (GPU 9223, 241fps, 3 warps): uScroll 0 throughout, zero frozen frames
(was 280/843 gated), real INSIDE→OUTSIDE_B crossings, no AC4 force-flip.
Headless 37/37. **Max UAT: ride warps — does the reversal go away?**

**Task B blocker FIXED `87d5560`, VERIFIED_PENDING_MAX** — distB at cruise start
was ~15-32u (varying), not 60: the swap fires at the Portal-A crossing DURING
enter, and the remainder of ENTER (22.5→45 u/s, up to ~1.5s) flew the camera
into the fresh pocket before HYPER. Fix: enter→hyper at `_swapFired` (WarpEffect)
— cruise now starts at the full pocket length (live: 59.8/58.1 across 2 runs,
deterministic; speed snap at the seam also shrank, ~26→20 vs 45→20).

**Max rode both fixes (UAT positive: "Much better already" / "Quite good") and set
3 next goals (2026-06-09, his words):** (1) Portal A spawns too far away — often
behind the nearest planet; should spawn "like 100m away"; (2) asteroid belt shows
through the tunnel walls; (3) entry hitch — "everything stops moving" at tunnel
entry. Target feel for all three: *one* long tunnel; after a few seconds of travel
the far end appears, grows, and the new system shows through it.
**3-goals session 1 (2026-06-10): Goal 1 shipped `ec47b84` (spawn 10u, live-verified,
window._warpPreviewDist UAT knob). Goal 3 partially fixed `db2388d` (swap compile
gate; stall inventory + open leads in handoff). Goal 2 statically diagnosed
(logdepthbuf mismatch), no fix yet.**
**3-goals session 2 (2026-06-10 cont.): Goals 2+3 FIXED** (`81fe37b` `094e8a2`
`f75842e` `c85480f`). **All 3 goals VERIFIED_PENDING_MAX. Max RODE it → flagged
"a little flash where the tunnel disappears after we enter it."**
**Flash session (2026-06-10): FIXED `4278037`, UAT-PASSED + SHIPPED (deployed)** —
sim-vs-render cadence bug at the Portal-A crossing, NOT a swap/load artifact; no
latency spent (Max's offered levers unneeded — load was already hidden; see
Last-updated line). Known residual nobody has felt yet: the far-end opening shows
black (gated sky) for the ~0.4s compile
window post-swap, then destination stars pop in — small (3u opening at ~60u),
measured sub-0.2%-of-pixels; fix candidates exist (keep old sky alive through
the gate) if he feels it. Other residuals: one unattributed ~530ms hyper frame
(1-in-10, likely GC).
**Handoff trail: `/tmp/well-dipper-warp-tunnel-tuning-handoff-2026-06-10b.md`** (its
§0 candidate mechanisms 1-4 all ruled out by evidence; §3 test method still current).
Older: `/tmp/well-dipper-warp-tunnel-tuning-handoff-2026-06-10.md` (§3 test method
still current; §1-2 closed).
Older context: `/tmp/well-dipper-warp-tunnel-tuning-handoff-2026-06-09b.md`,
`/tmp/well-dipper-warp-tunnel-tuning-handoff-2026-06-07b.md`,
`/tmp/well-dipper-warp-tunnel-tuning-handoff-2026-06-09.md`.

Prior sub-state — **Tasks 0–3 DONE; entry-reliability
Fix D implemented + live-verified, VERIFIED_PENDING_MAX (UAT).** Root cause was the
off-axis approach (camera advanced along mid-slerp facing, missing the 3u gate).
**Fix D** (`src/main.js` ~6753, UNCOMMITTED): advance camera *position* along the
locked `_tunnelForward` axis (orientation slerp unchanged); guard falls back to
facing post-swap. Preserves AC2 → no contract change. **Live result (GPU 9223, full
speed): fresh enterSol → 12/12 ALL_REGISTERED; 13–24 consecutive → 10/12.** Headless
`warp-tunnel-rebase.test.js` 4/4. Residual deep-state 2/12 = finding-#4 turn-alignment
accumulation (DEFERRED, separate thread). Off-axis root cause + Fix D writeup:
`docs/WORKSTREAMS/warp-tunnel-pocket-traversal-2026-06-06/entry-reliability-rootcause-2026-06-06.md` (session-3 addendum).
- Plan (8 tasks, 4–7 not started): `docs/superpowers/plans/2026-06-06-warp-tunnel-pocket-traversal.md` (`31b3c93`)
- Telemetry committed `4fc9a36`; warp commits (UNPUSHED, master): `5a94a19` (T0), `1427ebb`+`9c334c2` (T1), `a16d617`+`39fa8f2` (T2), `7064478` (T3)
- **Next:** Max UAT (ride warps — into Portal A / cruise / out Portal B, repeats + far targets) → commit Fix D → resume T4–7. Deferred: finding-#4 turn-alignment accumulation.

**Maps to journey:** Travel-loop signature moment (35% SCREENSAVER-MVP).

### Also pending Max UAT (separate)
- **`warp-landing-strip-persists-2026-05-10`** — VERIFIED_PENDING_MAX @ `e31ee65`.

## Next 1-3 queued (in priority order)

0. **`planet-refinement-campaign` — Phase 4b DONE 2026-06-10
   (`5460789`…`e5e9a45`, two sessions): all 10 atmosphere cards built +
   verdicted 🟡 taste-call VERIFIED_PENDING_MAX — F24-F26 bands, F27-F29
   storms, F30 lightning (emissive point process; review caught
   cell-boundary blob clipping pre-verify; 1 tune: intensity 2→4),
   F31 clouds family (regime dispatch: weather/haze/venus/eyeball; Rocky
   coverage 0.9→0.645 rebalance — the F26 burial fixed; F31e shells
   parked for 4c/F34), F32+F33 thermal pair (one energy-balance curve,
   two owned consumers, superrotation offset A/B'd). SEVEN new presets
   this phase: 3 gas giants, Venus, Sub-Neptune, Eyeball, Hot Jupiter
   (+ new hot-jupiter archetype). Vitest 19/19; evidence shots repo root
   (F24-*…F33-*). Taste forks recorded per card §7 for the Phase-7
   lap.** Next: Max starts a FRESH session and pastes the tracker's
   **Phase-4c `/goal` launch card** (optical+exotic+overlay+rings,
   15 cards + F38/F39 call). Session notes that carry: same-tick uniform
   reads lie (double-rAF or read state.*), freeze jetSpeed before A/Bs,
   sessionStorage restores stale solo/knob state over reloads (re-run
   setPreset + re-enable gates), solo() kills the bands substrate for
   band-riders (lightning/thermal are emissive-channel, immune).
1. **`warp-landing-strip-persists` Max UAT** — confirm the fix in Max's
   browser, then flip to Shipped + push.
2. **`warp-tunnel-second-half-not-rendering`** — **SHIPPED 2026-06-10:
   Max UAT-passed ("Looks like it works!") `1787c3f` + `2c23ee8`, pushed
   same day** (no rewrite needed). Arrival-distance (`04d3437`) UAT-passed
   in the same ride — margin stays at default 1.3 (no tune requested). TWO independent causes, both reproduced per-frame on GPU 9223
   after Max's UAT report ("freeze + second half missing on binary
   destinations"): (a) Portal-A re-anchor margin 1e-10 < float64 rounding
   at destination coords → spurious INSIDE→OUTSIDE_A one frame post-swap
   → disc B can never reveal, AC4 silent; binary correlation was larger
   orbitDist coords, not binarity. Margin → 0.5u + anchor from portal pos.
   (b) Null-seed known objects (IC1396/IC434/CasA/IC2602 — no messier/ngc)
   crash SkyFeatureLayer._hashSeed inside onSwapSystem → gate held, AC4
   stall, arrived system stranded with no sky/starfield. Seed falls back
   to catalog key + _hashSeed fails soft. 12-warp post-fix ride clean
   (dotA −0.5 invariant, everB all warps incl. binaries); IC1396-adjacent
   warp clean + follow-up warp not stranded. Tests:
   `portal-traversal-margin.test.js`, `known-object-feature-seed.test.js`.
   **NEW LATENT BUG found while pinning (separate, unfixed): IC434
   Horsehead shares IDENTICAL galacticPos with M78 and the known-object
   injection dedup splices it — Horsehead never renders anywhere.**
   Also shipped 2026-06-10: **default-mute** (`19134e9`) — app opens
   silent every load; session-only "Sound Enabled" checkbox in settings.
3. **`world-origin-reset-on-system-swap-2026-06-04`** — SCOPED (`466a0c5`),
   **awaiting GATE 1**, queued behind MVP. Structural fix to the rebasing
   bug class (wire dead `resetWorldOrigin()` + invariant test). Full review:
   `~/briefings/well-dipper-rebasing-review-2026-06-04.md`. (Rebasing fix
   #2 — duplicate-call/telemetry — committed `a1a01b6`, not pushed, live
   telemetry confirm pending.)

## Recently shipped

- **world-origin spawn-once-body centering** (2026-06-04) — single (non-binary)
  system stars, planet orbit rings, and asteroid belts were spawned at the raw
  scene origin and never rewritten per-frame, so in warp-reached systems they
  were displaced from the barycenter by `worldOrigin`-at-spawn (star "above the
  orbital plane"; rings/belts off-center). Fix: seed each into the rebased frame
  at spawn via `WorldOrigin.placeInRebasedFrame` (`main.js` single star @3557,
  binary-star rings, planet ring, belt; new `WorldOrigin.js` export). TDD'd
  (`tests/orbit-ring-rebase.test.js` — star invariant + characterization), Tester
  PASS, verified live: single-star `|planet−star| == orbitRadiusScene` 0% error +
  coplanar, planet rings centered on star/barycenter with exact radii, binaries
  unaffected. (WU7a `3946dca` deployed alongside — Tester PASS, planets render
  clean.)
- **Audit-3 remediation WU1 + WU3 + WU5** (2026-05-31) — three audit-3 bug-fix
  work-units shipped to production, each one commit + Tester PASS + deploy green:
  WU1 camera FrameDiagnostics ruler + NaN guard (`416a171`); WU3 disposal
  completeness across renderers + tunnel star-wrap seam (`45866f9`); WU5
  binary-system planet light-direction rebase fix (`fe9303a`). Plan + remaining
  WU6-WU9 in `~/briefings/well-dipper-audit3-remediation-plan.md`.
- **deep-sky-cleanup dead-code follow-up** (2026-05-31, `d018c60`) — multi-agent
  blast-radius audit of the cleanup found 0 bugs / all KEEP paths intact; only
  residue was orphaned `_navigable` machinery (the deleted `spawnNavigableDeepSky`
  was its sole writer). Removed `buildNavigableQueue`/`populateNavigableQueueRefs`,
  7 always-false branches, 8 always-true conjuncts, orphaned `simRandom` import;
  −160 LOC, no behavior change. Audit report:
  `~/briefings/well-dipper-deepsky-blast-radius-audit-2f1a878.md`. (Audits #3 bug /
  #2 architecture / #1 whole-codebase queued for later sessions.)
- **`deep-sky-cleanup-2026-05-29` SHIPPED** (2026-05-30) — removed the legacy
  random dice-roll arrival (`deepSkyChance` roll + `DestinationPicker` deep-sky
  weights/helpers + `spawnNavigableDeepSky` + `'deepsky'` audio track + autopilot
  deep-sky tour stops); −351 LOC. Every warp now lands a real star-system or
  explicit target. 3 KEEP paths intact (title backdrop, debug gallery,
  external-galaxy click). All 5 ACs verified live (chrome-devtools GPU); pushed
  to production GitHub Pages.
- **Doc-system v5 migration COMPLETE** (2026-05-29) — Phase 8
  (deep-sky-cleanup PM-scoped + GATE-1 approved) and Phase 11 (Scope
  frontmatter on all 39 workstreams; 3 transitional docs archived to
  `ARCHIVE/*_LEGACY.md`; README "Transitional artifacts" section removed;
  this NOW.md post-migration rewrite). All 11 phases done.
- **Phase 7 — FEATURES/{autopilot,warp}.md standardized to v5** (2026-05-29, `a4ddc47`) — `**Systems touched:**` lines + `## Player Beats` (F&F-MVP + ENRICHED/GAME, Keith form, observable ACs); prior prose preserved; `doc-rot` clean.
- **4 net-new FEATURES deep dives** (2026-05-25, `0373d1f`→`039b52c`) — galactic-rendering, nebulae, planet-rendering, nav-computer; nav-computer Level 4 COLUMN→PRISM rename (`039b52c`).
- **Phase 6 — SYSTEMS.md + SYSTEMS/app-shell/** (2026-05-19, `cb1fc4d`) — 26-system flat map, `app-shell` deep dive, doc-graph + doc-rot clean.
- `ac4b477` — **Phase 5 — FEATURES.md** Max-authoritative inventory (69 rows)
- `5a97e41` — **Phase 9 — CLAUDE.md transform** (62 → 81 lines) + JOURNEY structural-debt section
- `81c9f22` — **Phase 4 — MOOD index** wired
- `75c4a35` — **Phase 3 — Scripts** (doc-rot, doc-graph, uat-status, mood-bootstrap, pre-push hook)
- `8625a8a` — **Phase 2 — Infrastructure** (PILLARS, PLAYER_EXPERIENCE, 8 PROTOCOLS, README)
- `fd98f23` — **Phase 1 — Archive** (~50 file moves)
- **Phase 10** — pre-push hook (fires `npm run doc-rot` on every push)

## Open structural decisions (from session)

- **Historical-workstream Scope `# unverified` back-fill** — Phase 11
  added Scope frontmatter to all 37 historical workstreams, but `paths:`
  were left `[] # unverified` (not back-filled from shipped commits), and
  6 process/ambiguous ones have `systems: [] # unverified`
  (canvas-recording-workflow-formalization, dev-collab-three-layer-testing,
  warp-shipped-gate-process-fix, ooi-capture-and-exposure-system). Back-fill
  each when its workstream is next touched. Not blocking.
- **code-explorer + code-architect version control** — currently no git tracking. Max flagged for revisit. Options: `well-dipper/docs/PERSONAS/` + symlink up; separate `claude-agents` repo; accept untracked.
- **Ship NPC spawning disable for F&F** — `ShipSpawner` turned off before F&F ship; preserve code for ENRICHED reactivation. Small follow-up workstream; not yet scoped.
- **Christian (Max's brother) music tracks status** — `hyperspace / warp-charge / arrival` wired in MusicManager but absent on disk. (`deepsky` track removed from the list in deep-sky-cleanup, shipped 2026-05-30.) Status of brother's deliveries unknown.

## Deferred (deliberate)

- **Per-system SYSTEMS/<sys>/ROADMAPs** — authored fresh when each system gets its first deep dive (Rule 1 no empty folders).
- **Sol-naming triage** — `body.star.sol` not tagged in partial inspection layer.
- **PARKING_LOT.md** — P1/P2/P3 deferred items; migrate to per-system Open Questions when those systems get deep dives (tracked in JOURNEY structural debt).

## What's NOT in the queue right now

- Layer-3 GAME features (15+ rows in FEATURES.md GAME section) — gated by F&F MVP ship completion.
- New ENRICHED work — gated by F&F MVP ship. 4 ENRICHED rows currently.
- Doc system v6 — not foreseen; v5 expected to hold ≥6 months.

## Session checklist (start of each working session)

1. Re-read `HEART_OF_DESIRE.md`
2. Skim `JOURNEY.md` current-objective section
3. Read THIS file's Active workstream + Next 1-3
4. Check `~/.claude/state/dev-collab/active-workstream.json` matches Active workstream (if mismatched, this file is stale — update before proceeding)

## How this file updates

- **Working-Claude updates at session end** per CLAUDE.md session-end protocol
- **Max edits** when priorities shift, when items move in/out of queue, when deferred status changes
- Don't let this file grow past one screen.
