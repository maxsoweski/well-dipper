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

> **▶ LANE C (2026-07-08): naming-census-uniqueness-2026-07-07 → VERIFIED_PENDING_MAX (code `3336dd7`,
> branch `feature/system-details`).** Serves the exploration-immersion outcome ("players never encounter
> the same system name twice"). Landed: Horsehead IC434/M78 position fix + 4 stale tests; deterministic
> name census; HYG catalog regenerated (0 `"` artifacts, 15,559 usable real names — CSV-parser root-cause
> fix); real names win on every targeting path; position-derived injective procgen naming (survey +
> multipart, zero duplicates by construction, no-position fallback now throws); shipped named-systems
> catalog (12k settled + 36k greek notables, 40% near features, 0.82MB gzip). Full verify 3/3-adversarial
> green + live chrome-devtools checks (Horsehead renders rank#2 with M78 #7; Sol 19/19 scene suite;
> revisit round-trip stable). **UAT round 1 (2026-07-08): "looks good in general, BUT" — Sirius search
> spawned Sol. FIXED `631571b` (2026-07-09):** Sol's KnownSystems match radius 5 pc → 0.5 pc (was
> swallowing 12 real stars: Sirius 2.64 pc, Rigil Kentaurus 1.32 pc, Procyon…) + teleport arrivals now
> carry the real star's name via `RealStarCatalog.findByPosition()` (same precedence warp already had).
> Re-verified: new match-radius suite incl. full-catalog sweep, 1113/1113 vitest, live Sirius→"Sirius",
> Solar preset→real Sol, scene suite 19/19; light verify addendum
> `verdict-light-sirius-fix-631571b.json` (AC1 re-checked green end-to-end). **UAT round 2 (2026-07-10):
> Sirius OK, BUT nav computer named Sol "Talimon". FIXED `d8d6b63` (2026-07-11):** AC9 catalog regen had
> dropped Sol (HYG row 0 has dist=0 → distance filter); regen script now emits Sol explicitly (catalog
> back to 15,599, +1 entry only). Plus identity-aware nav-warp arrival: nav entry named "Sol" warps to
> REAL Sol with position snapped to registry (was: blanket hasNavStar skip → procgen impostor).
> Verified: 1114/1114 vitest, live PRISM shows Sol gold-labeled + you-are-here ring, nav-style warp from
> 1 pc-off grid position spawns real Sol, negative-case nav warp unaffected, scene suite 19/19.
> **Post-fix hardening (2026-07-11, Max-directed):** 8-angle subagent code review of the two fixes → 11
> verified candidates, 6 survived → applied via workflows: `7f5fd1e` (teleport arrivals force real
> spectral type — Sirius now A-class; currentGalaxyStar realigned on known-system arrivals; dead `"`
> guard dropped; tolerance-ordering invariant exported + tested) and `a1d2d4c` (identity-join redesign:
> KnownSystems.associate() derives aliases from catalog stars within MATCH_RADIUS — self-healing across
> regens; findByAlias name gate + 3 pc belt replaces the display-name lambda; makes future Alpha
> Centauri registration work — HYG names its components Rigil Kentaurus/Toliman). 1123/1123 vitest,
> live belt accept/reject verified, scene suite 19/19. Successor flags recorded in `a1d2d4c` message.
> **✅ UAT PASSED (Max, 2026-07-11)** — Sol works; workstream CLOSED at `a1d2d4c` (FEATURES.md row
> added). **Now IN MASTER + DEPLOYED** — lane B's `847ab19` pre-deploy merge (2026-07-11) folded this
> branch in; `feature/system-details` is a strict ancestor of master (build sessions: just ff onto
> master first). Contract: `docs/WORKSTREAMS/naming-census-uniqueness-2026-07-07/`.
> **▶ SUCCESSOR SCOPED (2026-07-12): `real-universe-overlay-2026-07-12`** — interview done (Max's 4
> facets: nav-neighborhood fidelity, player search, observed characteristics, structures; rulings:
> true positions never procgen-snapping, bulk exoplanet ingest + curated companion table, structures
> = search+audit only, settled-catalog UI folds into search, seedtags stays parked). 10 ACs incl.
> AC10 engine structural support (degenerate star class, known-planet injection, far-companion; Alpha
> Cen = A+B binary + Proxima far companion, authoring proof). Contract survived a 3-lens adversarial
> review (12 findings folded, 3 blockers: multiplicity had no data source/engine support) + round-2
> re-verify (clean + 3 residuals folded). Resolves D6–D9. Contract:
> `docs/WORKSTREAMS/real-universe-overlay-2026-07-12/` (schema-valid, status building).
> **▶ GREENLIT (Max 2026-07-12) → Increment 1 (AC7 ingest) BUILT `77723c2` (2026-07-13).** AC8
> baseline captured FIRST (`1fc7357`: 24 procgen-only systems, deep-equal + re-filter hook). Archive
> verified live (pscomppars 6319 planets/4735 hosts; attribution license). Built via 5-agent workflow
> (opus builders, sonnet integrate, **fable adversarial verifier** — Max's today-only unlock) + 8
> post-build rulings (design doc §Post-build): known-binary allowlist (HD 20781/20782, TOI-2267 A/B),
> companion-table-derived duplicate exemption (Proxima vs Rigil/Toliman per contract's Alpha Cen
> architecture), Kepler-90-as-KOI-351, lum 4-sig-digits, ICU-stable sorts. Shipped: ingest script
> (byte-identical, exit 0, drops 0/7/7/27/260 reported), real-system-contents.json (4457 hosts/6030
> planets), real-star-supplement.json (14 dim hosts), stellarCompanions.js (5 web-cited entries),
> blocklist 323→325 (0 named-catalog collisions), 18 contract tests. Suite 1249 passed (vendor noise
> unchanged). ⚠ **BINDING Increment-3 input:** overlay merge joins by NAME first — 104/116 same-named
> hosts sit >0.1 pc from their HYG record (Hipparcos-vs-Gaia distance disagreement, max 141 pc).
> **▶ Increment 2 (AC10+AC5) BUILT `d106181` (2026-07-13).** Design-first (`65994e2`, 2 explorer passes),
> built via resumed 4-agent workflow (opus builders/reviewer, sonnet integrate; builder-2's report died on
> StructuredOutput — work was on disk, recovered via audit-stage resume). Landed: STAR_PROPERTIES.D
> (spec-only, never rolled) + normalizeSpectralClass ('DA2'→'D'); ctx companionSpec/knownPlanets/
> farCompanions (omitted-not-null — AC8 snapshot held byte-identical); KnownSystemAuthoring adapter routes
> declarative entries THROUGH StarSystemGenerator; Alpha Centauri entry = companionsRef only (A+B from
> stellarCompanions, Proxima planets via gen-known-system-contents.mjs generated module); Proxima alias
> derived from companion table; both anticipated test flips (findAt(RIGIL_POS)→Alpha Cen; ingest clearance
> exemption); ONE surgical main.js line (map injection at associate()). Cap rules: representation-cap.md
> (`c713625`). Suite 1276 (was 1249). Verify full ×2 (2nd run after an API-crash rerun of the AC10 check):
> **AC10 PASS 3/3 + AC7 PASS 3/3**; AC5 static-green + **LIVE-DRIVEN same day** (Max brought up :5176 +
> debug Chrome): nav-warp at Rigil, Proxima-position-targeted warp, and debug-search teleport ALL spawn
> the authored Alpha Centauri (G2V+K1V @23.5 AU, Proxima far companion w/ planets b,d, names aligned, no
> impostor); Sol intermediate spawned as Sol; **AC8 live enterSol() 19/19 CLEARED** (owed since Inc 1);
> console zero errors/warns. Addendum: `verdict-live-drives-d106181.json` (sky-click deferred w/ rationale
> — same findAt branch as teleport, plumbing untouched). ⚠ Inc-3 BINDING inputs: name-first join
> (unchanged); ExoticOverlay._applyFungal 1-candidate crash must be fixed BEFORE D-primaries become
> reachable; injected known planets need migration/stability immunity (TRAPPIST-class).
> **▶ Increment 3 (AC3+AC4 bulk overlay merge) BUILT `c68c1fb` + VERIFIED + LIVE-DRIVEN (2026-07-13).**
> Pre-work `d417a39` (fungal 1-candidate fix, TDD, cadence-preserving) + design `240ec99` (2 explorer
> passes — both died at StructuredOutput, findings recovered from transcripts → new rule
> `feedback_workflow-structuredoutput-hazard.md`). Landed: RealSystemOverlay (name-first join, dup-name
> position disambiguator, display-name→hostname bridge, unready-warn); supplement+contents ride
> RealStarCatalog.load() Promise.all (15,613 stars — TRAPPIST-1/Proxima arrivable); known-planet
> immunity (migration/resonance/cull/exotic + slot guarantee — the ~4,000-host spurious-binary threat:
> 2,437 hosts have a planet <0.1 AU); TWO surgical main.js edits (warp+teleport else-branches,
> coordinator-flagged); merged display names (real designations); cap §5. Adversarial review 1 MED
> (fill-letter dup of known designation under migration reorder) fixed in-thread + pinned. Suite
> 1278→1321; ProcgenSnapshot 24/24. Verify full at `c68c1fb`: **AC4 + AC7 + AC10 PASS 3/3**;
> AC3/AC5/AC8 live-closed same day (verdict-live-drives-c68c1fb.json): Sol 19/19, Sirius **A+D binary
> @19.8 AU**, TRAPPIST-1 **M + all 7 knowns, real designations on HUD**, Rigil→authored Alpha Cen,
> console clean. Merged-star nav-warp deferred w/ rationale (close at Inc-4 search or AC9). Structure
> stays table-only — **snum-as-single-pin parked as an AC9/UAT knob** (with Alpha-Cen fill policy).
> **▶ Increment 4 (AC2 player search) BUILT `44c7075` + VERIFIED + LIVE-DRIVEN (2026-07-13).** Design
> `f40bac2` (2 explorer passes). New pure resolver `knownObjectSearch.js` (ports DebugPanel three-source
> search + ADDS named-systems catalog class-b + registry-name bridge so 'Alpha Centauri'/'Sol' resolve +
> toNavStar seed-parity). NavComputer: DOM `<input>` overlay, `_searchFocused` capture-guard **+**
> bubble `stopPropagation` (both phases needed — build caught my design miss), result list w/ keyboard
> nav, Escape clears+blurs, 'D' swatch; select → **genuine warp** via the real `_onCommit`→
> `dispatchNavAction`→`_setWarpTargetFromNavStar` contract (never teleport, never hand-set `_warpTarget`).
> +2 flagged main.js input-wiring lines. Max-ratified NavComputer seam recorded in `increment-4-design.md`
> for lane D. Suite 1321→1340 (0 new failures); ProcgenSnapshot byte-identical. Verify full at `44c7075`:
> **AC4+AC7+AC10 PASS 3/3** (unregressed); AC2/AC3/AC5/AC8 live-closed same day
> (verdict-live-drives-44c7075.json): reachable via N; keyboard guard **both phases** ('WASDRFN' all land,
> nav stays open); all 4 resolve classes; **search→warp→Sirius = real A1V+DA2 binary @19.8 AU**
> (CLOSES the owed Gate-4 merged-star nav-warp; routes through the Inc-3 arrival merge); search→warp→Sol =
> authored Sol; Sol integration suite **19/19**; console clean. Boot-tour warp-collision edge case
> documented (in-flight boot warp overrides a mid-boot selection — NOT an AC2 defect; lane-B tour/N-gating
> territory). Parked knobs: **snum==1 single-pin ADOPTED** (Max; representation-cap §5, `cd8abd0`);
> Alpha-Cen A/B fill = Max's rec-open call at Inc-5.
> **▶ Increment 5 (AC1 + AC6 + snum-pin + fill ruling) BUILT `3e58fac` + VERIFIED + LIVE-DRIVEN (2026-07-14)
> → workstream VERIFIED_PENDING_MAX.** Design `4775f5f` (2 explorer passes; OOM sequential-builder rule
> suspended by Max → 3 parallel opus builders + gate + adversarial review, 1 fix round — the review CAUGHT the
> AC6 builder dying on the boilerplate-spawn glitch and the fix round built it). Landed: AC1
> `neighborhood-reference.json` (19 Sol / 15 Sirius neighbors, shipped-catalog distances, 6 absent-famous
> documented) + **NavComputer position-snap FIX** (matched real stars rendered at hash-grid positions up to
> 2 pc off — interview-ruling-1 violation; now catalog-true) + `window._navComputer` handle; AC6 Harris
> Part-III per-cluster radii (152 distinct, 1.9–180.2 pc, replaces uniform 30 pc) + committed audit that
> CAUGHT 3 real position errors (M13 1.53 kpc off!, M57, M45 z-sign — corrected); snum==1 single-pin
> (resolve()-side, one-directional, table-wins; AC4 case (e) amendment validated; AC3 immunity vehicle →
> 55 Cnc); Alpha-Cen **fill-ON ruled by Max** w/ zero-planet-rate condition → documentation only
> (representation-cap §6: existing 8% empty roll + astronomy basis + named-not-built calibration seam).
> Suite 1340→**1404** (0 new failures); ProcgenSnapshot 24/24; ZERO main.js edits. verify-workstream full
> (wf_1eab0d7b-3eb, 39 agents): **AC4+AC6+AC7+AC10 PASS 3/3** (AC6 flipped from FAIL-as-scheduled);
> AC1/AC2/AC3/AC5/AC8 live-closed same day, TWO circuits (`verdict-live-drives-3e58fac.json`): AC1 both
> vantages **worst error 0.03% vs ±2%** (34 assertions), TRAPPIST-1 visible @12.43 pc AND arrives as M
> SINGLE w/ exactly 7 knowns b–h (the pin live), authored Alpha Cen G2V+K1V@23.5 AU + Proxima(b,d), Sirius
> A1V+DA2@19.8 AU (table-wins), Sol 19/19 ×3, console clean. **⚠ AC9 flag: Alpha Cen A/B drew ZERO fill
> planets on the authored seed** (fill-on active; deterministic empty branch / circumbinary geometry) —
> small authoring knob if Max wants the flagship populated.
> **▶ NEXT: AC9 = Max's batched UAT over the whole workstream** (nav neighborhood from Sol, search things he
> knows, arrivals vs astronomy, structures; the α-Cen zero-planet flag above is his call). The only open
> gate. Branch UNPUSHED (merge Max-gated; deploy = Pages).

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

### Supercruise / in-system flight — SHIPPED TO MASTER 2026-06-28 (incl. sublight + 2 UAT fixes)

> **▶ SHIPPED TO MASTER + DEPLOYED (2026-06-28).** The whole supercruise/free-look/arrival-modes
> arc (149 commits) merged & deployed to GitHub Pages — master `09db316`. Same arc added **sublight
> propulsion** (drive-OFF throttle → forward/stop/reverse at SUBLIGHT_CAP), a **hard collision
> barrier** (never fly through a body), and **mass-based forced-drop/mass-lock** near stars. Then
> **two post-ship UAT fixes pushed `15d7189`** (code `f455f39` + Rule-3 docs): **(A)** in HELM
> hands-on the cursor is hidden and the mouse IS the flight stick, so **left-click now selects the
> body under the center reticle** — planets/moons selectable, not just background stars; **(B)**
> forced-drop/mass-lock is **direction-aware** — engage + fly off when pointed AWAY from a star, a
> head-on approach still drops you (capture). Both live-verified via chrome-devtools (reticle-on-
> Mercury click → Mercury selected; sim-loop nose-toward force-drops / nose-away stays engaged);
> **259 unit tests green, build clean.** Spec `docs/superpowers/specs/2026-06-28-uat-fixes-select-masslock-design.md`.
> The "deploy deferred" status below is SUPERSEDED. Handoff resolved (both issues closed):
> `/tmp/well-dipper-supercruise-uat-fixes-handoff-2026-06-28.md`.
>
> **▶ ALSO FIXED + PUSHED (2026-06-28) — procedural orbital realism `a04bf4a`.** Max UAT
> (sublight): planets visibly drifted away when parked near them in procedural systems (Sol was
> fine). Root cause: `StarSystemGenerator` anchored Kepler's law on the system's innermost-planet
> AU (a VISUAL map-layout quantity), not the physical Mercury reference (0.387 AU) Sol uses →
> procedural orbits ran 1.6×–100× too fast (worst on luminous/binary stars). Fix: `keplerOrbitSpeed()`
> anchored on physical AU; migration + resonance-snap now recompute speed (a stale-speed migrant bug
> the test also caught). At `celestialTimeMultiplier 1.0` (realistic, default) motion is imperceptible
> by design — now true for procedural too. Test `StarSystemGenerator.orbit-realism.test.js` (8 seeds,
> ±30% of real Kepler). Build clean; pre-existing KnownObjects/GalacticFeatures failures unrelated.
> **Max UAT pending:** warp to a procedural system, park at sublight, confirm planets sit still.
>
> **▶ NEXT (deferred to a fresh session, Max 2026-06-28) — Orrery/God's-Eye navigation UX.** Click a
> star system → travel there; click a planet → instantly move to it; orbit lines ON by default
> (`showOrbits: false`→true, `Settings.js:21`). Feature w/ 3 small feel decisions → brainstorm first.
> Handoff with anchors: `/tmp/well-dipper-orrery-navigation-handoff-2026-06-28.md`.

**`supercruise-freelook-2026-06-10`** — **ALL 13 tasks + control harness BUILT,
live-verified, and UAT-PASSED by Max** (live ride 2026-06-27: "it's good to ship").
Elite-style supercruise is now THE in-system mover for BOTH drivers — autopilot
(tour legs + post-warp fly-in + COMMIT BURN) and the player (manual W/S throttle +
mouse virtual-joystick + hold-to-look freelook + screen-space HUD). **F is a 2-state
ON/OFF flight toggle**; flight TYPE (Manual / Align-on-select / Assist) is a Settings
enum. The control harness `src/flight/ShipControls.js` is the single-door surface both
drivers go through; legacy `AutopilotMotion` + `NavigationSubsystem` + `FlythroughCamera`
motion roles are RETIRED from the live path (files kept; NPC `ShipSpawner` spawn gated
off via `SHIPS_ENABLED=false`).
Contract (9 ACs) + intent + plan:
`docs/WORKSTREAMS/supercruise-freelook-2026-06-10/` +
`docs/superpowers/plans/2026-06-10-supercruise-freelook.md`.
**Status:** UAT-passed on branch `feature/supercruise-freelook` @ `7bd261c` (pushed to
origin). **Master merge + GitHub-Pages deploy DEFERRED** — the next arc (reach-the-planet
drop-out + mode restructure) builds directly on these same systems, and master has an
active World-Engine session (main.js/NOW.md merge-conflict surface). Merge when both arcs
are ready to land. Headless at the ship commit (verified 2026-06-27): build clean, flight
+ camera + ui suites green (200/200). Last fix `7bd261c`: F-off no longer snaps back to the focused body (clears focus
on exit). Full arc trail: `memory/well-dipper-supercruise-progress.md`.
**Maps to journey:** completes the travel-loop foundation the 35% SCREENSAVER-MVP
autopilot rides + lands the first player-flight (GAME-tier) capability.
**Known quirk (not blocking, deferred):** Assist sometimes fails to converge within ~55s
and auto-flips its target to a moon (e.g. Dione) — separate flight/selection issue.
**▶ NEXT arc (scoping now):** reach-the-planet drop-out + forced-out-near-planet +
enter/exit camera-shake FX + mode restructure (Toybox / Flight / Free-look, autopilot as
a flight subset). Research workflow running; brainstorm + scope pending.

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
