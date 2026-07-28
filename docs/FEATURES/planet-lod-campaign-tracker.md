# Planet feature refinement campaign — index

**Spec:** [`2026-06-09-planet-feature-refinement-campaign-design.md`](../superpowers/specs/2026-06-09-planet-feature-refinement-campaign-design.md) (v2 = §13, autonomous /goal chain)
**Plan:** [`2026-06-09-planet-feature-refinement-campaign.md`](../superpowers/plans/2026-06-09-planet-feature-refinement-campaign.md)
**Supersedes** the completion campaign (2026-06-07); F11 artifact log preserved below.
**Per-feature method:** spec §13.3 (autonomous reference-compare) + §13.4 (heavy
loop for ⬜). Verdicts are `VERIFIED_PENDING_MAX` until Max's Phase-7 review lap.

Legend: status ✅ built · 🟡 partial · ⬜ unbuilt | rating 🟢/🟡/🔴/parked (set
during phases) | ▶️ = current

## Phase status

| Phase | Goal | Status |
|---|---|---|
| 1 Research fan-out (Workflow, not /goal) | 48 dossier cards committed | ✅ 2026-06-09 |
| 2 Foundation | FOUNDATION.md verdicted | ✅ 2026-06-10 (4×🟢; chroma-speckle taste-call for Phase 7) |
| 3 Refine built (15 cards) | all §7 verdicts + galleries | ✅ 2026-06-10 (13🟢, F03 🟡 taste-call, F08 🟡 Max-feedback fix1) |
| **Stage-D provinces** (inserted before 4a per Max 2026-06-10) | spike → scope → build → verify; all 15 built features province-aware | ✅ built 2026-06-10 — spike `05cde11`, build `3d04110`, VERIFIED_PENDING_MAX; workstream `docs/WORKSTREAMS/stage-d-provinces-2026-06-10/`; Phase-4a+ combiners now author against the LIVE `provinceWeight(PROV_<FEATURE>)` accessor + add affinity rows to `PROVINCES` (planet-archetypes.js) AND the GLSL chain |
| 4a Build fluvial+aeolian (8) | F12-F16,F19-F21 verdicted | ✅ 2026-06-10 — all 8 verdicted (F14/F16 🟢, F12/F13/F15/F19/F20/F21 🟡 taste-call); next ▶️ 4b |
| 4b Build atmosphere (10) | F24-F33 verdicted | ✅ 2026-06-10 — all 10 🟡 taste-call VERIFIED_PENDING_MAX; new presets: 3 gas giants + Venus + Sub-Neptune + Eyeball + Hot Jupiter; new archetype hot-jupiter |
| 4c Build optical+exotic+overlay+rings (15) | F34-F37,F40-F49,F51 + F38/F39 call | 🔁 REOPENED 2026-06-13 by Max. Formal /goal was met (13× 🟡 + F44/F46 🟢 verdicts; F51 v1 `093523c`; F38/F39 rec recorded) — Max overrode two outcomes: F51 rings REWORK + F38/F39 → BUILD both. **F51 rework CLOSED 2026-06-13: v2 3D-LOD-particle ring built + integrated (`9bcd71d`), 🟢 VERIFIED_PENDING_MAX (awaiting Max UAT).** Remaining 4c work: **F38 airglow + F39 cloud-optics (BUILD both)**. Other 12 cards stay VERIFIED_PENDING_MAX. |
| 5 Integration | INTEGRATION.md I-1…I-15 verdicted | **PLANNED 2026-06-20** — reframed from verify-only to *build the couplings*: [`planet-lod-phase5-integration-plan.md`](planet-lod-phase5-integration-plan.md) sequences the audit's 52 gaps into WS1–WS5 + cross-cutting; I-1…I-15 become the acceptance layer run after the builds. WS1 (keystone `filled` surfacing — 7 gaps) = recommended first build. Each WS scoped via `dev-collab-scope` when built (none built yet). |
| 6 Profiles | PROFILES.md 18 rows verdicted | pending |
| 7 Max review lap | galleries walked, parked items decided | pending |

## Feature index

| F# | Card | Domain | Status | Rating | Phase |
|---|---|---|---|---|---|
| F1 | [F01-mountains](cards/F01-mountains.md) | Relief | ✅ | 🟢 | 3 |
| F2 | [F02-craters](cards/F02-craters.md) | Relief | ✅ | 🟢 | 3 |
| F3 | [F03-ejecta-rays](cards/F03-ejecta-rays.md) | Relief | ✅ | 🟡 taste-call | 3 |
| F4 | [F04-canyons-rifts](cards/F04-canyons-rifts.md) | Relief | ✅ | 🟢 | 3 |
| F5 | [F05-scarps-faults](cards/F05-scarps-faults.md) | Relief | ✅ | 🟢 | 3 |
| F6 | [F06-plateaus-tessera](cards/F06-plateaus-tessera.md) | Relief | ✅ | 🟢 | 3 |
| F7 | [F07-volcanic-edifices](cards/F07-volcanic-edifices.md) | Relief | ✅ | 🟢 | 3 |
| F8 | [F08-lava-plains-flows](cards/F08-lava-plains-flows.md) | Relief | ✅ | 🟡 Max-feedback fix1 | 3 |
| F9 | [F09-chaos-terrain](cards/F09-chaos-terrain.md) | Relief | ✅ | 🟢 | 3 |
| F10 | [F10-ridged-icy-terrain](cards/F10-ridged-icy-terrain.md) | Relief | ✅ | 🟢 | 3 |
| F11 | [F11-river-networks](cards/F11-river-networks.md) | Fluvial | ✅ | 🟢 | 3 |
| F17 | [F17-glacial-landforms](cards/F17-glacial-landforms.md) | Cryo | ✅ | 🟢 | 3 |
| F18 | [F18-sublimation-landscapes](cards/F18-sublimation-landscapes.md) | Cryo | ✅ | 🟢 | 3 |
| F22 | [F22-polar-caps-frost](cards/F22-polar-caps-frost.md) | Cryo | ✅ | 🟢 | 3 |
| F23 | [F23-snowline](cards/F23-snowline.md) | Cryo | ✅ | 🟢 | 3 |
| F12 | [F12-deltas-fans](cards/F12-deltas-fans.md) | Fluvial | ✅ | 🟡 taste-call | 4a |
| F13 | [F13-outflow-channels](cards/F13-outflow-channels.md) | Fluvial | ✅ | 🟡 taste-call | 4a |
| F14 | [F14-lakes-seas](cards/F14-lakes-seas.md) | Fluvial | ✅ | 🟢 | 4a |
| F21 | [F21-karst-dissolution](cards/F21-karst-dissolution.md) | Fluvial | ✅ | 🟡 taste-call | 4a |
| F15 | [F15-dunes-wind-forms](cards/F15-dunes-wind-forms.md) | Aeolian | ✅ | 🟡 taste-call | 4a |
| F16 | [F16-dust-mantles](cards/F16-dust-mantles.md) | Aeolian | ✅ | 🟢 | 4a |
| F19 | [F19-mass-wasting](cards/F19-mass-wasting.md) | Gradational | ✅ | 🟡 taste-call | 4a |
| F20 | [F20-coastlines](cards/F20-coastlines.md) | Gradational | ✅ | 🟡 taste-call | 4a |
| F24 | [F24-zonal-belts](cards/F24-zonal-belts.md) | Bands | ✅ | 🟡 taste-call | 4b |
| F25 | [F25-jets-shear](cards/F25-jets-shear.md) | Bands | ✅ | 🟡 taste-call | 4b |
| F26 | [F26-latitude-weather-bands](cards/F26-latitude-weather-bands.md) | Bands | ✅ | 🟡 taste-call | 4b |
| F27 | [F27-great-spot](cards/F27-great-spot.md) | Storms | ✅ | 🟡 taste-call | 4b |
| F28 | [F28-storm-clusters](cards/F28-storm-clusters.md) | Storms | ✅ | 🟡 taste-call | 4b |
| F29 | [F29-polar-vortex](cards/F29-polar-vortex.md) | Storms | ✅ | 🟡 taste-call | 4b |
| F30 | [F30-lightning](cards/F30-lightning.md) | Storms | ✅ | 🟡 taste-call | 4b |
| F31 | [F31-clouds-family](cards/F31-clouds-family.md) | Clouds | ✅ | 🟡 taste-call | 4b |
| F32 | [F32-dayside-hotspot](cards/F32-dayside-hotspot.md) | Thermal | ✅ | 🟡 taste-call | 4b |
| F33 | [F33-nightside-glow](cards/F33-nightside-glow.md) | Thermal | ✅ | 🟡 taste-call | 4b |
| F34 | [F34-limb-glow](cards/F34-limb-glow.md) | Optical | ✅ | 🟡 taste-call | 4c |
| F35 | [F35-terminator-gradient](cards/F35-terminator-gradient.md) | Optical | ✅ | 🟡 taste-call | 4c |
| F36 | [F36-sunglint](cards/F36-sunglint.md) | Optical | ✅ | 🟡 taste-call | 4c |
| F37 | [F37-aurorae](cards/F37-aurorae.md) | Optical | ✅ | 🟡 taste-call | 4c |
| F40 | [F40-dust-storms](cards/F40-dust-storms.md) | Dust | ✅ | 🟡 taste-call | 4c |
| F41 | [F41-magma-ocean](cards/F41-magma-ocean.md) | Exotic | ✅ | 🟡 taste-call | 4c |
| F42 | [F42-carbon-crust](cards/F42-carbon-crust.md) | Exotic | ✅ | 🟡 taste-call | 4c |
| F43 | [F43-crystalline-facets](cards/F43-crystalline-facets.md) | Exotic | ✅ | 🟡 taste-call | 4c |
| F44 | [F44-hex-tessellation](cards/F44-hex-tessellation.md) | Exotic | ✅ | 🟢 | 4c |
| F45 | [F45-shattered-crust](cards/F45-shattered-crust.md) | Exotic | ✅ | 🟡 taste-call | 4c |
| F46 | [F46-fungal-mats](cards/F46-fungal-mats.md) | Overlay | ✅ | 🟢 | 4c |
| F47 | [F47-machine-surface](cards/F47-machine-surface.md) | Overlay | ✅ | 🟡 taste-call | 4c |
| F48 | [F48-city-lights](cards/F48-city-lights.md) | Overlay | ✅ | 🟡 taste-call | 4c |
| F49 | [F49-ecumenopolis](cards/F49-ecumenopolis.md) | Overlay | ✅ | 🟡 taste-call | 4c |
| F51 | [F51-rings](cards/F51-rings.md) | Crosscutting | 🟢 v2 VERIFIED_PENDING_MAX | 3D LOD particle ring (impostor far + emergent THREE.Points cloud near) + 6 lab sliders; `71eea7a`; Max approved-in-principle, awaiting slider-driven UAT | 4c |
| — | [FOUNDATION](cards/FOUNDATION.md) (F50/F52/F53 substrate) | Foundation | ✅ | 🟢 | 2 |
| — | [INTEGRATION](cards/INTEGRATION.md) | Crosscutting | — | — | 5 |
| — | [PROFILES](cards/PROFILES.md) | Crosscutting | — | — | 6 |
| F38/F39 | airglow / cloud-optics — no dossier yet | Optical | **KEEP — BUILD both (Max 6-13, overrode drop rec)** ↓ | 4c |

## F38 / F39 — MAX DECIDED: BUILD BOTH (2026-06-13, overrode the DROP rec)

**Decision:** Max wants both F38 airglow and F39 cloud-optics built. The drop
recommendation below is RETAINED as the design challenge, not a verdict — it names
exactly what the build must overcome (envelope-crush, redundancy, missing data). Both
need a dossier card authored first (none exists) then the §13.4 heavy loop. Neither is
implemented anywhere yet (confirmed: no airglow/glory/rainbow planet identifier in
`planet-lod-lab.html` or `src/`).

Original criteria used for the (now-overridden) recommendation: (1) fit with the
6-level posterize + Bayer-dither retro envelope, (2) redundancy with already-built
features, (3) availability of driver data the pipeline models, (4) build cost. **These
are now the constraints the build must solve, not reasons to skip it:**

- **F38 — Airglow / nightglow limb band → RECOMMEND DROP as a standalone feature.**
  - *Envelope fit:* the source itself flags it `[subtle]` — "a faint diffuse night-limb
    ring." A low-contrast smooth gradient is exactly what the 6-level posterize crushes:
    it quantizes to one flat band (indistinguishable from the body edge) or vanishes. The
    triage note (planet-visual-features.md:483) pre-warns against spending budget here.
  - *Redundancy:* three already-built `[current]` features paint the same night-limb
    region — F34 limb/atmosphere rim glow, F33 nightside-glow, and F37 aurorae (same P24
    driver, occupying the night limb with the BRIGHT version of the phenomenon). F38 would
    render a fainter sibling of effects already present.
  - *If Max wants any airglow read:* the cheap honest move is a 1-line tweak to F33/F34
    (a faint constant night-limb tint on the existing term), NOT a new feature/card.

- **F39 — Cloud optics (rainbows / glories) → RECOMMEND DROP.**
  - *Envelope fit (worst in the catalog):* a rainbow is a smoothly continuous spectral
    arc and a glory is sub-degree concentric colour rings — the highest-frequency COLOUR
    detail in the whole feature set. The retro envelope (6-level posterize + restrained
    palette) is purpose-built to destroy exactly that: the arc crushes into 2-3 hard
    colour steps reading as a banding artifact, not a rainbow; the glory's rings are
    sub-pixel at planet distance.
  - *Missing data:* requires uniform-droplet cloud microphysics (droplet-size
    monodispersity) the pipeline doesn't model, layered on the F31 cloud substrate.
  - *Cost:* high implementation cost + worst envelope fit + missing input → drop. If Max
    ever wants a nod, a "Venus glory" reads better as a tiny bright forward-scatter hotspot
    on the F31 cloud deck (a sub-tweak to F31) than as a rainbow renderer.

**~~Net recommendation: DROP both~~ — OVERRIDDEN. Max wants both built (2026-06-13).**
The fold-in hints stay useful as *cheapest-honest* fallbacks if the standalone build
can't beat the envelope: F38 airglow → night-limb tint on F33/F34; F39 glory → bright
forward-scatter hotspot on the F31 cloud deck. But the directive is BUILD standalone
first. Design challenge for both: make a `[subtle]` optical effect survive the 6-level
posterize without crushing — likely means stylizing toward discrete, higher-contrast
forms (a defined airglow band; a 2-3 banded "rainbow arc" read as deliberate posterized
colour steps, not a failed smooth gradient) rather than physical literalism.

## Launch cards — the exact /goal lines Max types

Copy-paste one per phase, in order, each in a FRESH session started in
~/projects/well-dipper (handoff-at-seam between phases). Phase 1 is not a
/goal — say "run campaign phase 1" and working-Claude runs the Workflow per
the plan. Constraints inside each goal protect the warp WIP.

**Phase 2:**
/goal Foundation pass for the planet refinement campaign (read docs/FEATURES/planet-lod-campaign-tracker.md and the plan first): docs/FEATURES/cards/FOUNDATION.md section 7 contains a dated 🟢/🟡/🔴 verdict with evidence for all four substrate checks, at least one screenshot per check exists under docs/FEATURES/cards/shots/ (ls output shown in transcript), all fixes and card edits are committed, and `git status --porcelain planet-lod-lab.html planet-archetypes.js docs/FEATURES` printed in the transcript shows no output. Only modify planet-lod-lab.html, planet-archetypes.js, and docs/ paths; never git add -A. Or stop after 15 turns and summarize what's parked.

**Phase 3:**
/goal Refine-built pass: each of the 15 built-feature cards in docs/FEATURES/cards/ (F01,F02,F03,F04,F05,F06,F07,F08,F09,F10,F11,F17,F18,F22,F23) has a section-7 verdict (🟢/🟡/🔴 or parked, dated, with screenshot filenames listed), `npx vitest run tests/planet-archetypes.test.js` passes in the transcript, and `git status --porcelain planet-lod-lab.html planet-archetypes.js docs/FEATURES` shows no output. Max 3 fix cycles per feature then mark parked. Only modify planet-lod-lab.html, planet-archetypes.js, docs/ paths; never git add -A. Or stop after 35 turns and summarize what's parked.

**Phase 4a:**
/goal Build pass, fluvial+aeolian: each of the 8 cards F12,F13,F14,F15,F16,F19,F20,F21 in docs/FEATURES/cards/ has a section-7 verdict; every newly built feature is registered in planet-archetypes.js FEATURES with a working solo toggle (state shown via window._lab.featureEnabled in transcript); `npx vitest run tests/planet-archetypes.test.js` passes; `git status --porcelain planet-lod-lab.html planet-archetypes.js docs/FEATURES` shows no output. Heavy loop per the campaign spec §13.4 (card §6.5 build plan → subagent implement → code-review → verify). Max 3 fix cycles per mechanism then park. Only modify planet-lod-lab.html, planet-archetypes.js, docs/ paths; never git add -A. Or stop after 45 turns and summarize what's parked.

**Phase 4b:**
/goal Build pass, atmosphere: each of the 10 cards F24,F25,F26,F27,F28,F29,F30,F31,F32,F33 in docs/FEATURES/cards/ has a section-7 verdict; newly built features registered in planet-archetypes.js FEATURES with working solo toggles; `npx vitest run tests/planet-archetypes.test.js` passes; `git status --porcelain planet-lod-lab.html planet-archetypes.js docs/FEATURES` shows no output. Heavy loop per spec §13.4; max 3 fix cycles then park. Only modify planet-lod-lab.html, planet-archetypes.js, docs/ paths; never git add -A. Or stop after 45 turns and summarize what's parked.

**Phase 4c:**
/goal Build pass, optical+exotic+overlay+rings: each of the 15 cards F34,F35,F36,F37,F40,F41,F42,F43,F44,F45,F46,F47,F48,F49,F51 has a section-7 verdict; F38 and F39 each have a recorded keep/stylize/drop recommendation marked parked-for-Max in the tracker; newly built features registered with working solo toggles; `npx vitest run tests/planet-archetypes.test.js` passes; `git status --porcelain planet-lod-lab.html planet-archetypes.js docs/FEATURES` shows no output. Heavy loop per spec §13.4; max 3 fix cycles then park. Only modify planet-lod-lab.html, planet-archetypes.js, docs/ paths; never git add -A. Or stop after 45 turns and summarize what's parked.

**Phase 5:**
/goal Integration pass: docs/FEATURES/cards/INTEGRATION.md section 7 has a verdict (🟢/🟡/🔴/parked with screenshot filenames) for every check I-1 through I-15; `npx vitest run tests/planet-archetypes.test.js` passes; `git status --porcelain planet-lod-lab.html planet-archetypes.js docs/FEATURES` shows no output. Max 3 fix cycles per check then park. Only modify planet-lod-lab.html, planet-archetypes.js, docs/ paths; never git add -A. Or stop after 25 turns and summarize what's parked.

**Phase 6:**
/goal Profiles pass: every one of the 18 type rows in docs/FEATURES/cards/PROFILES.md has a verdict; missing lab presets authored as data in planet-archetypes.js/lab preset list; the Appendix-B cross-check note at the bottom of PROFILES.md is filled in; `npx vitest run tests/planet-archetypes.test.js` passes; `git status --porcelain planet-lod-lab.html planet-archetypes.js docs/FEATURES` shows no output. Max 3 fix cycles per row then park. Only modify planet-lod-lab.html, planet-archetypes.js, docs/ paths; never git add -A. Or stop after 25 turns and summarize what's parked.

**Phase 7 (no /goal):** say "review lap" — working-Claude assembles
docs/FEATURES/REVIEW-LAP.md (ordered card links + Windows-pasteable shot paths +
all parked/taste-call items) and walks you through it.

## Per-feature artifact log (carried over)

| Feature | Spec | Plan | Commit(s) | Verified |
|---|---|---|---|---|
| F11 | [f11 spec](../superpowers/specs/2026-06-07-f11-fluvial-river-networks-design.md) | [f11 plan](../superpowers/plans/2026-06-07-f11-fluvial-river-networks.md) | spike `172526d` · shader `2f3855a` · drivers `27155da` · GUI+registry `cd7f263` · tint+verify `573083e` | ✅ lab; folded into Phase-3 refinement |

## Parking-lot — proposed new features (not yet scoped)

Ideas captured for a future campaign feature (dossier card + §13.4 heavy loop),
**NOT to be built inline** during a fix/triage session. Promote to the Feature
index + a launch card when Max greenlights scoping.

- **Tectonics survives the radius fade** (logged 2026-07-28, Max, during the radius-R1 re-UAT) —
  verbatim: *"rocky/earthlike planets' tectonics seem to turn into noise after the planet radius
  gets beyond a certain size; not sure if that's intentional, especially given we created the
  tectonics system before implementing the new radius system."*
  **Root cause identified from source the same session (DERIVED, not yet measured):**
  `bakeReliefCrossover(sVis) = 1 − smoothstep(0, BAKE_CROSS_SPAN=1.0, |log2 sVis|)`
  (`planet-lod-lab-core.js`) deliberately crossfades the **baked** relief to zero as the disc
  departs `sVis = 1`, handing the macro body to the analytic `fbmd` path. With `sVis = √R`,
  `|log2 sVis| = 0.5·|log2 R|` ⇒ the bake is **half faded at R = 2** and **entirely gone at R ≥ 4**
  (and at R ≤ 0.25). On Rocky/Earthlike the baked cube is exactly where the plate-Voronoi tectonics
  lives (`writePlateUpliftSphere` — continents, plate boundaries, provinces); `fbmd` is generic fBm.
  So above R ≈ 4 the tectonic structure is replaced with noise **by construction**.
  **It was a disclosed tradeoff**, not an accident — the source comment reads *"RESIDUE (disclosed,
  D3): the baked continent PATTERN morphs into the analytic body across the fade — a visible change
  in continent CHARACTER, not size; the size-constancy bar is met."* What was never weighed is that
  character loss against the world engine's purpose, which is that tectonics should *express*.
  Max's ordering note is the diagnosis: tectonics predates the radius system.
  **Scope question (not a fix):** how does plate-scale structure hold its identity while individual
  form size stays constant on screen? Candidates — domain-scale the plate partition the way `fbmd`
  is domain-scaled rather than fading it; re-bake at the new scale; or split the crossover so
  macro (plate) structure is exempt from the fade while micro relief hands off. Needs measurement
  of where it *reads* as noise (the R ≥ 4 figure is the code's behaviour, not the perceptual bar).
  Related: the R2 "5 radius-blind tectonics modules" row in `RADIUS-CENSUS.md`.

- **Outpost worlds** (logged 2026-06-15) — Mars/Venus-type sparse **nightside outpost
  lights**: a few scattered points/clusters, distinct from the dense `ecumenopolis`
  city-glow and `cityLights` features. The visual: a not-yet-civilized world showing
  a handful of human/alien outposts on the dark side. Needs PM-scope (driver: habitability
  floor? a new "settlement-stage" axis below the ecumenopolis gate?), then a dossier card.

## Session pickup (inside a goal phase)

1. Read this tracker → Phase-status table → current phase; find first
   unverdicted card in that phase.
2. Per feature: card §5 isolation recipe → :9223 solo → screenshots to
   cards/shots/ → compare vs card §3 refs + §4 math → verdict to card §7 →
   update Feature-index Rating column → commit explicit paths.
3. Unbuilt features: write card §6.5 build plan first, then heavy loop
   (spec §13.4). New features MUST be registered in planet-archetypes.js
   FEATURES + lab featureFolders + enable key (vitest enforces).
4. Shared-tree caution: warp WIP — stage only explicit paths, never git add -A.
