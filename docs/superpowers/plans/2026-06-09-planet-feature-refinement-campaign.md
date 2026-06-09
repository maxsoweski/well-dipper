# Planet Feature Refinement Campaign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute spec v2 (`docs/superpowers/specs/2026-06-09-planet-feature-refinement-campaign-design.md` §13): set up the campaign apparatus (cards, tracker-index, checklists, research workflow), then run the autonomous `/goal` phase chain that verifies built features, builds unbuilt ones, integrates dependent systems, and validates per-type profiles — ending in Max's batched review lap.

**Architecture:** Tasks 1–5 are doc/apparatus setup (no shader code). Task 6 runs the Stream-A research Workflow and writes 48 dossier cards. Task 7 is the runbook + exact `/goal` launch cards for phases 2–6 (Max types these; working-Claude executes inside them).

**Tech Stack:** Claude Code `/goal` (≥2.1.139), Workflow tool (in-harness), chrome-devtools MCP on `:9223`, vitest, `planet-lod-lab.html` / `planet-archetypes.js`.

**Hard guardrails (apply to every task and every goal turn):**
- Stage explicit paths only — **never `git add -A`** (warp WIP shares this tree). Allowed paths: `planet-lod-lab.html`, `planet-archetypes.js`, `docs/FEATURES/**`, `docs/superpowers/**`, `.gitignore`, `tests/planet-archetypes.test.js`.
- `planet-lod-lab.html` backtick parity stays EVEN (check with `grep -c '\`' planet-lod-lab.html` → even number).
- Testing on `:9223` GPU Chrome via chrome-devtools MCP, never Playwright, never Bash curl for liveness (`memory/well-dipper-testing-reference.md`).
- 3-cycle cap per uncertain mechanism → mark `parked`, move on.
- Commit at every feature seam.

---

## Locked naming

**Card files:** `docs/FEATURES/cards/F##-<slug>.md`, zero-padded to two digits. The 48 in-scope cards:

| | | | |
|---|---|---|---|
| F01-mountains | F02-craters | F03-ejecta-rays | F04-canyons-rifts |
| F05-scarps-faults | F06-plateaus-tessera | F07-volcanic-edifices | F08-lava-plains-flows |
| F09-chaos-terrain | F10-ridged-icy-terrain | F11-river-networks | F12-deltas-fans |
| F13-outflow-channels | F14-lakes-seas | F15-dunes-wind-forms | F16-dust-mantles |
| F17-glacial-landforms | F18-sublimation-landscapes | F19-mass-wasting | F20-coastlines |
| F21-karst-dissolution | F22-polar-caps-frost | F23-snowline | F24-zonal-belts |
| F25-jets-shear | F26-latitude-weather-bands | F27-great-spot | F28-storm-clusters |
| F29-polar-vortex | F30-lightning | F31-clouds-family | F32-dayside-hotspot |
| F33-nightside-glow | F34-limb-glow | F35-terminator-gradient | F36-sunglint |
| F37-aurorae | F40-dust-storms | F41-magma-ocean | F42-carbon-crust |
| F43-crystalline-facets | F44-hex-tessellation | F45-shattered-crust | F46-fungal-mats |
| F47-machine-surface | F48-city-lights | F49-ecumenopolis | F51-rings |

**Special cards (no F#):** `FOUNDATION.md`, `INTEGRATION.md`, `PROFILES.md`.
**Screenshots:** `docs/FEATURES/cards/shots/F##-<slug>-NN-<view>.png` (e.g. `F11-river-networks-01-solo-d8.png`). Gitignored, persistent on disk.
**Card body schema:** spec §5 (sections 1–7). Cards for unbuilt features say `Unbuilt (aspirational)` in §2 and gain a `§6.5 Build plan` during their heavy loop.

---

### Task 1: Gitignore the shots directory

**Files:**
- Modify: `.gitignore`
- Create: `docs/FEATURES/cards/shots/.gitkeep` (empty file — `shots/` itself must exist and ship)

- [ ] **Step 1:** Append to `.gitignore`:

```
# planet refinement campaign screenshot galleries (large PNGs; persistent on disk, reviewed from Windows)
docs/FEATURES/cards/shots/*.png
```

- [ ] **Step 2:** `mkdir -p docs/FEATURES/cards/shots && touch docs/FEATURES/cards/shots/.gitkeep`
- [ ] **Step 3:** Verify: `git check-ignore docs/FEATURES/cards/shots/test.png` → prints the path; `git status --porcelain .gitignore docs/FEATURES` → shows only `.gitignore` + `.gitkeep`.
- [ ] **Step 4:** Commit:

```bash
git add .gitignore docs/FEATURES/cards/shots/.gitkeep
git commit -m "campaign: gitignore card screenshot galleries"
```

### Task 2: FOUNDATION.md — the substrate checklist

**Files:**
- Create: `docs/FEATURES/cards/FOUNDATION.md`

- [ ] **Step 1:** Write the file with exactly this content:

```markdown
# Foundation Card — substrate UAT (Phase 2)

Everything every feature inherits. Feature tweaks cannot compensate for a wrong
substrate. Judged in the lab on :9223 (GPU Chrome; liveness via list_pages).
Bar: "reads right in the 6-level posterized envelope" — form/behavior, not pixels.

## Check 1 — Base FBM continents
View: preset "Rocky (Earthlike)", distance 20, then 8. Reroll seed 3×.
Judge:
- [ ] Landmasses read as continents (coherent shapes, natural coastline complexity)
- [ ] No visible tiling, axis-aligned banding, or pole pinching
- [ ] Reroll produces varied but same-character worlds
Reference: Earth/Mars albedo maps (dossier-style refs in shots/ captions).

## Check 2 — Lighting model
View: preset "Rocky (Earthlike)", distance 8; rotate light via lab GUI.
Judge:
- [ ] Terminator position matches light direction; shading follows displacement
  (ridges lit on sun side, shadowed opposite)
- [ ] No inverted/flat normals at poles or seams
- [ ] Analytic-derivative normals stay stable while zooming (no shading pop)

## Check 3 — Posterize + 4×4 Bayer envelope (F50)
View: any preset, distance 12, slow auto-rotate ~30s.
Judge:
- [ ] 6 levels read clearly; dither pattern stable (no shimmer/crawl while rotating)
- [ ] Gradients quantize into deliberate bands, not accidental contours
- [ ] Envelope flatters rather than crushes relief shading (compare envelope
  off/on via GUI toggle)

## Check 4 — LOD ramp (F53 scaffolding)
View: preset "Rocky (Earthlike)"; sweep window._lab.state.distance 20 → 2 → 20.
Judge:
- [ ] Detail octaves rise/fall smoothly; no popping at thresholds (hysteresis works)
- [ ] No fizz/aliasing at limb or horizon at close range (fwidth clamp holding)
- [ ] window._lab.lodRampOf(distance) values monotonic across the sweep (log values)

────────── §7 verdicts (filled during Phase 2) ──────────

## 7. Verdict + tweak log
- Check 1: (pending)
- Check 2: (pending)
- Check 3: (pending)
- Check 4: (pending)
```

- [ ] **Step 2:** Commit:

```bash
git add docs/FEATURES/cards/FOUNDATION.md
git commit -m "campaign: foundation substrate checklist (Phase 2 card)"
```

### Task 3: INTEGRATION.md — the dependent-pairs checklist

**Files:**
- Create: `docs/FEATURES/cards/INTEGRATION.md`

- [ ] **Step 1:** Write the file with exactly this content (pair list derived from the catalogue's shared machinery + driver gates):

```markdown
# Integration Card — cross-feature composition (Phase 5)

Each check: enable ONLY the named features (window._lab solo/enable flags),
render on :9223, screenshot to shots/INT-NN-<slug>.png, verdict 🟢/🟡/🔴/parked.
Composition machinery under test: combiner chain order, canyonHeight accumulator,
shared drivers from deriveUniforms(), the D6/P25 atmosphere gate, overlay
compositing, the posterize envelope, the LOD ramp.

## I-1 Rivers × canyons (F11×F04)
Fluvial incision and tectonic canyons share the canyon accumulator. Both on:
rivers must incise INTO canyon walls coherently, not z-fight or double-carve.

## I-2 Rivers × lakes/seas (F11×F14)
River trunks terminate at standing-liquid level; no channels continuing
underwater or hanging above shoreline.

## I-3 Deltas × coastlines × seas (F12×F20×F14)
Deltas form exactly at river–sea junctions; coastline morphology yields to the
fan; no deltas on riverless coasts.

## I-4 Frost/caps over relief (F22/F23×F01–F10)
Frost drapes topography (altitude + latitude gating), brightening ridges above
the snowline; caps follow PLD layering over underlying terrain, not paint over it.

## I-5 Glacial × mountains (F17×F01)
Valley glaciers occupy relief valleys; flow lineations align downslope.

## I-6 Sublimation × frost (F18×F22)
Pits etch INTO frost fields where insolation hits (equator-facing), absent
under fresh seasonal frost.

## I-7 Dunes × dust mantles (F15×F16)
Both need dry+windy (D5 + low liquid): they co-occur on the same worlds and
share wind direction; streaks align with dune orientation.

## I-8 Clouds over terrain × weather bands (F31a×F26)
Terrestrial clouds cluster along the ITCZ/latitude bands; ground remains
readable through gaps; cloud shadows (if any) offset with light direction.

## I-9 Bands × storms (F24×F27/F28/F29)
Spots sit IN band shear lanes (counter-rotating edges), polar vortex centered
on pole; storm colors derive from band palette, not free-floating.

## I-10 Atmosphere gate consistency (D6/P25 × everything)
An airless preset ("Frozen (airless)") must show NO rivers/deltas/dunes/clouds/
limb-glow/weather — the whole gradational+atmospheric stack gated off together,
while craters/ejecta stay crisp (no degradation).

## I-11 Aurora × magnetic gate (F37×D13)
Aurora only when fieldStrength > 0.05; ring latitude/width scale with field;
airless-but-magnetized still allowed (aurora without weather).

## I-12 Rings × eclipse shadows (F51×F52)
Ring shadow bands on planet dayside; planet shadow sweeps rings; Cassini gap
visible in both lit ring and shadow.

## I-13 Thermal day/night × tidal lock × eyeball ring (F32/F33×D7×F31f)
Locked worlds: hotspot fixed (eastward-shifted if superrotating), terminator
cloud ring stationary, nightside glow only on the night hemisphere.

## I-14 Overlay compositing (F46–F49 × base planet)
Overlays coat a natural base (spec L1c rule): base oceans/relief/weather show
through where overlay coverage < 1; ecumenopolis glow respects nightside.

## I-15 LOD coherence (F53 × all combiners)
Sweep distance 20→2 on a feature-rich preset: all enabled features fade/sharpen
together; no single feature pops or vanishes out of step.

────────── §7 verdicts (filled during Phase 5) ──────────

## 7. Verdict + tweak log
- I-1 … I-15: (pending)
```

- [ ] **Step 2:** Commit:

```bash
git add docs/FEATURES/cards/INTEGRATION.md
git commit -m "campaign: integration pair checklist (Phase 5 card)"
```

### Task 4: PROFILES.md — the per-type validation checklist

**Files:**
- Create: `docs/FEATURES/cards/PROFILES.md`

- [ ] **Step 1:** Write the file with exactly this content (18 Appendix-A types × expected features, cross-checked against Appendix B; "Lab preset" names existing presets from `planet-archetypes.js` or marks one to author during Phase 6):

```markdown
# Profiles Card — per-type feature validation (Phase 6)

For each Appendix-A type: load/author its lab preset (driver bundle), render on
:9223, check expected features PRESENT and wrong features ABSENT, sanity-check
deriveUniforms() driver values, screenshot to shots/PRO-<type>-NN.png, verdict.
Regression net: npx vitest run tests/planet-archetypes.test.js after any
registry/preset change. Types are presets over drivers (Appendix A) — a profile
failure is usually a DRIVER WIRING bug, not a feature bug.

| Type | Lab preset | Must show | Must NOT show | Verdict |
|---|---|---|---|---|
| rocky | Rocky (Earthlike) — verify driver fit, else author "Rocky (airless Mars-like)" | F1 F2 F3 F5 F8 F19 F40(dust) | clouds, rivers, glow | (pending) |
| terrestrial | Rocky (Earthlike) | F11 F12 F14 F17 F22 F26 F31a F34 F35 F37 (richest) | magma, carbon flats | (pending) |
| ocean | Ocean (temperate) | F14 F20 F36 F31a F34, low relief | mountain belts, dust storms | (pending) |
| ice | Europa (icy moon) | F2 F9 F10 F17 F18 F22 | liquid-water seas, lava | (pending) |
| lava | Lava (hot airless) | F8 F41, emissive cracks | frost, clouds, rivers | (pending) |
| venus | AUTHOR in Phase 6 | F31d blanket, F7 pancake, F29 polar vortex, F25 | visible surface relief through clouds, city lights | (pending) |
| carbon | AUTHOR in Phase 6 | F42 dark crust + diamond glints, hydrocarbon flats | water oceans, green biome tints | (pending) |
| gas-giant | AUTHOR in Phase 6 | F24 F25 F27 F28 F29 F30 | any solid-surface feature | (pending) |
| hot-jupiter | AUTHOR in Phase 6 | F32 F33 F24 (thermal day/night asymmetry) | frost, surface relief | (pending) |
| eyeball | AUTHOR in Phase 6 | F31f pupil+ring, F22 nightside cap + terminator melt ring | uniform global weather | (pending) |
| sub-neptune | AUTHOR in Phase 6 | F31c featureless haze (F31e shells if built) | crisp bands, surface detail | (pending) |
| hex | AUTHOR in Phase 6 | F44 tiling, F29 hexagon hook | natural fluvial/aeolian forms | (pending) |
| shattered | AUTHOR in Phase 6 | F45 fracture blocks, F9 | intact smooth plains everywhere | (pending) |
| crystal | AUTHOR in Phase 6 | F43 facet fields, F3 glints | weather stack | (pending) |
| fungal | AUTHOR in Phase 6 | F46 mats OVER terrestrial/ocean base (base shows through) | overlay erasing base entirely | (pending) |
| machine | AUTHOR in Phase 6 | F47 circuit grid OVER rocky base | natural-only surface | (pending) |
| city-lights | AUTHOR in Phase 6 | F48 nightside cities over terrestrial base | dayside light leakage | (pending) |
| ecumenopolis | AUTHOR in Phase 6 | F49 whole-surface build-out + glow | raw wilderness patches (unless intended) | (pending) |

Notes:
- "AUTHOR in Phase 6" = add a named preset (driver bundle) to the lab presets +
  archetype mapping if missing; presets are data (planet-archetypes.js + lab
  preset list), keep DATA ONLY per that file's header rule.
- Appendix-B cross-check: after all rows verdicted, re-read the coverage matrix
  and confirm no ●/◐ cell contradicts a verdict (e.g. "gas × F-relief = –"
  must mean gas presets show zero relief).

## 7. Verdict + tweak log
(pending)
```

- [ ] **Step 2:** Commit:

```bash
git add docs/FEATURES/cards/PROFILES.md
git commit -m "campaign: per-type profile checklist (Phase 6 card)"
```

### Task 5: Tracker rewrite — refinement index + launch cards

**Files:**
- Modify: `docs/FEATURES/planet-lod-campaign-tracker.md` (full rewrite)

- [ ] **Step 1:** Replace the entire file with:

```markdown
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
| 1 Research fan-out (Workflow, not /goal) | 48 dossier cards committed | ▶️ pending |
| 2 Foundation | FOUNDATION.md verdicted | pending |
| 3 Refine built (15 cards) | all §7 verdicts + galleries | pending |
| 4a Build fluvial+aeolian (8) | F12-F16,F19-F21 verdicted | pending |
| 4b Build atmosphere (10) | F24-F33 verdicted | pending |
| 4c Build optical+exotic+overlay+rings (15) | F34-F37,F40-F49,F51 + F38/F39 call | pending |
| 5 Integration | INTEGRATION.md I-1…I-15 verdicted | pending |
| 6 Profiles | PROFILES.md 18 rows verdicted | pending |
| 7 Max review lap | galleries walked, parked items decided | pending |

## Feature index

| F# | Card | Domain | Status | Rating | Phase |
|---|---|---|---|---|---|
| F1 | [F01-mountains](cards/F01-mountains.md) | Relief | ✅ | — | 3 |
| F2 | [F02-craters](cards/F02-craters.md) | Relief | ✅ | — | 3 |
| F3 | [F03-ejecta-rays](cards/F03-ejecta-rays.md) | Relief | ✅ | — | 3 |
| F4 | [F04-canyons-rifts](cards/F04-canyons-rifts.md) | Relief | ✅ | — | 3 |
| F5 | [F05-scarps-faults](cards/F05-scarps-faults.md) | Relief | ✅ | — | 3 |
| F6 | [F06-plateaus-tessera](cards/F06-plateaus-tessera.md) | Relief | ✅ | — | 3 |
| F7 | [F07-volcanic-edifices](cards/F07-volcanic-edifices.md) | Relief | ✅ | — | 3 |
| F8 | [F08-lava-plains-flows](cards/F08-lava-plains-flows.md) | Relief | ✅ | — | 3 |
| F9 | [F09-chaos-terrain](cards/F09-chaos-terrain.md) | Relief | ✅ | — | 3 |
| F10 | [F10-ridged-icy-terrain](cards/F10-ridged-icy-terrain.md) | Relief | ✅ | — | 3 |
| F11 | [F11-river-networks](cards/F11-river-networks.md) | Fluvial | ✅ | — | 3 |
| F17 | [F17-glacial-landforms](cards/F17-glacial-landforms.md) | Cryo | ✅ | — | 3 |
| F18 | [F18-sublimation-landscapes](cards/F18-sublimation-landscapes.md) | Cryo | ✅ | — | 3 |
| F22 | [F22-polar-caps-frost](cards/F22-polar-caps-frost.md) | Cryo | ✅ | — | 3 |
| F23 | [F23-snowline](cards/F23-snowline.md) | Cryo | ✅ | — | 3 |
| F12 | [F12-deltas-fans](cards/F12-deltas-fans.md) | Fluvial | ⬜ | — | 4a |
| F13 | [F13-outflow-channels](cards/F13-outflow-channels.md) | Fluvial | ⬜ | — | 4a |
| F14 | [F14-lakes-seas](cards/F14-lakes-seas.md) | Fluvial | 🟡 | — | 4a |
| F21 | [F21-karst-dissolution](cards/F21-karst-dissolution.md) | Fluvial | ⬜ | — | 4a |
| F15 | [F15-dunes-wind-forms](cards/F15-dunes-wind-forms.md) | Aeolian | ⬜ | — | 4a |
| F16 | [F16-dust-mantles](cards/F16-dust-mantles.md) | Aeolian | ⬜ | — | 4a |
| F19 | [F19-mass-wasting](cards/F19-mass-wasting.md) | Gradational | ⬜ | — | 4a |
| F20 | [F20-coastlines](cards/F20-coastlines.md) | Gradational | ⬜ | — | 4a |
| F24 | [F24-zonal-belts](cards/F24-zonal-belts.md) | Bands | 🟡(game) | — | 4b |
| F25 | [F25-jets-shear](cards/F25-jets-shear.md) | Bands | 🟡 | — | 4b |
| F26 | [F26-latitude-weather-bands](cards/F26-latitude-weather-bands.md) | Bands | 🟡 | — | 4b |
| F27 | [F27-great-spot](cards/F27-great-spot.md) | Storms | 🟡 | — | 4b |
| F28 | [F28-storm-clusters](cards/F28-storm-clusters.md) | Storms | 🟡 | — | 4b |
| F29 | [F29-polar-vortex](cards/F29-polar-vortex.md) | Storms | 🟡 | — | 4b |
| F30 | [F30-lightning](cards/F30-lightning.md) | Storms | ⬜ | — | 4b |
| F31 | [F31-clouds-family](cards/F31-clouds-family.md) | Clouds | 🟡 | — | 4b |
| F32 | [F32-dayside-hotspot](cards/F32-dayside-hotspot.md) | Thermal | 🟡 | — | 4b |
| F33 | [F33-nightside-glow](cards/F33-nightside-glow.md) | Thermal | 🟡 | — | 4b |
| F34 | [F34-limb-glow](cards/F34-limb-glow.md) | Optical | 🟡 | — | 4c |
| F35 | [F35-terminator-gradient](cards/F35-terminator-gradient.md) | Optical | 🟡 | — | 4c |
| F36 | [F36-sunglint](cards/F36-sunglint.md) | Optical | ⬜ | — | 4c |
| F37 | [F37-aurorae](cards/F37-aurorae.md) | Optical | 🟡 | — | 4c |
| F40 | [F40-dust-storms](cards/F40-dust-storms.md) | Dust | 🟡 | — | 4c |
| F41 | [F41-magma-ocean](cards/F41-magma-ocean.md) | Exotic | ⬜ | — | 4c |
| F42 | [F42-carbon-crust](cards/F42-carbon-crust.md) | Exotic | ⬜ | — | 4c |
| F43 | [F43-crystalline-facets](cards/F43-crystalline-facets.md) | Exotic | ⬜ | — | 4c |
| F44 | [F44-hex-tessellation](cards/F44-hex-tessellation.md) | Exotic | ⬜ | — | 4c |
| F45 | [F45-shattered-crust](cards/F45-shattered-crust.md) | Exotic | ⬜ | — | 4c |
| F46 | [F46-fungal-mats](cards/F46-fungal-mats.md) | Overlay | ⬜(lab) | — | 4c |
| F47 | [F47-machine-surface](cards/F47-machine-surface.md) | Overlay | ⬜(lab) | — | 4c |
| F48 | [F48-city-lights](cards/F48-city-lights.md) | Overlay | ⬜(lab) | — | 4c |
| F49 | [F49-ecumenopolis](cards/F49-ecumenopolis.md) | Overlay | ⬜(lab) | — | 4c |
| F51 | [F51-rings](cards/F51-rings.md) | Crosscutting | 🟡 | — | 4c |
| — | [FOUNDATION](cards/FOUNDATION.md) (F50/F52/F53 substrate) | Foundation | ✅ | — | 2 |
| — | [INTEGRATION](cards/INTEGRATION.md) | Crosscutting | — | — | 5 |
| — | [PROFILES](cards/PROFILES.md) | Crosscutting | — | — | 6 |
| F38/F39 | airglow / cloud-optics — keep/stylize/drop call, no dossier | Optical | `[subtle]` | — | 4c |

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
```

- [ ] **Step 2:** Verify all 51 card links resolve to the names in this plan's "Locked naming" table (cards won't exist until Phase 1 — link *targets* must match exactly).
- [ ] **Step 3:** Commit:

```bash
git add docs/FEATURES/planet-lod-campaign-tracker.md
git commit -m "campaign: tracker -> refinement index + /goal launch cards"
```

### Task 6: Phase 1 — research workflow (execution step)

**Run only after Tasks 1–5 are committed.** This is the Stream-A fan-out: 48 agents, one dossier each; the main session writes the cards. In-harness Workflow = regular tokens (Max-20x pool), NOT metered Agent-SDK credit. Real spend: ~48 web-researching agents — Max opted in (spec §7).

**Files:**
- Create: `docs/FEATURES/cards/F##-<slug>.md` × 48 (written by the main loop from dossier objects)

- [ ] **Step 1:** Confirm clean doc state: `git status --porcelain docs/FEATURES` → empty.
- [ ] **Step 2:** Invoke the Workflow tool with `args` = the 48-entry feature array (id/slug/name/domain straight from the Locked-naming table + tracker Domain column) and this script:

```javascript
export const meta = {
  name: 'planet-dossier-fanout',
  description: 'One research dossier per in-scope planet feature (campaign Phase 1)',
  phases: [{ title: 'Research', detail: 'one agent per L2 feature' }],
}

const DOSSIER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['featureId', 'slug', 'description', 'currentShaderApproach',
              'references', 'mathModelingNotes', 'isolationRecipe', 'whatToJudge'],
  properties: {
    featureId: { type: 'string' },
    slug: { type: 'string' },
    description: { type: 'string', description: 'Card §1 — feature, variants, real-body examples, from the inventory' },
    currentShaderApproach: { type: 'string', description: 'Card §2 — as-built in planet-lod-lab.html with file:line refs, or "Unbuilt (aspirational)" + nearest existing machinery' },
    references: {
      type: 'array', minItems: 3, maxItems: 8,
      items: {
        type: 'object', additionalProperties: false,
        required: ['url', 'kind', 'caption'],
        properties: {
          url: { type: 'string' },
          kind: { type: 'string', enum: ['real', 'art'] },
          caption: { type: 'string', description: 'one-line "what to notice"' },
        },
      },
    },
    mathModelingNotes: { type: 'string', description: 'Card §4 — how academia/games/sims model this, path to a shader implementation' },
    isolationRecipe: { type: 'string', description: 'Card §5 — exact :9223 solo steps if built; recommended recipe if unbuilt' },
    whatToJudge: { type: 'array', minItems: 3, maxItems: 8, items: { type: 'string' } },
  },
}

const PROMPT = (f) => `Research dossier for planet-lab feature ${f.id} "${f.name}" (domain: ${f.domain}, card slug: ${f.slug}). Project: /home/ax/projects/well-dipper.

1. Read docs/FEATURES/planet-visual-features.md. Find the ${f.id} row in the L2 tables; also read its source P#/D# rows (L1/L0) so the description reflects the physical chain. Card §1 = that content, condensed, with variants and real-body examples.

2. Grep planet-archetypes.js and planet-lod-lab.html for this feature (search the F-number, the feature name words, and likely combiner/uniform names). If built: document the actual approach with file:line references — combiner function, its drivers/uniforms, GUI folder. If absent: currentShaderApproach = "Unbuilt (aspirational)." plus one sentence on the nearest existing machinery it should plug into.

3. References: WebSearch for REAL photographic/data references (NASA photojournal, USGS Astrogeology, ESA, JAXA, LPI, university pages) AND art/stylized references (game art, concept art, retro-styled renders). HARD RULE: cite ONLY URLs that actually appeared in your search/fetch results — never construct, guess, or pattern-complete a URL. Prefer stable institutional pages over hotlinked images. kind: "real" or "art". Each caption = one line on what to notice for OUR style target.

4. mathModelingNotes: how the field models this (geomorphology equations, procedural-generation papers, shader techniques from games/demos). Reuse the vocabulary of research/RESEARCH_high-lod-planet-shaders-2026-06-05.md (read it). End with the most promising shader-side approach in 2-3 sentences.

5. isolationRecipe: if built — exact steps: window._lab.solo('<key>') with the real key from planet-archetypes.js FEATURES, camera distance(s) via window._lab.state.distance, best preset name. If unbuilt — the recipe to use once built (recommended key name, preset, distances).

6. whatToJudge: 3-8 bullets, each framed "does it read as <form/behavior> in the 6-level posterized envelope?" — form and behavior, NEVER pixel-match against photos.

Style target context: retro/dithered 6-level posterize + 4x4 Bayer envelope; reference guides form, not photorealism. Your final output is the StructuredOutput object only.`

const results = await parallel(args.features.map(f => () =>
  agent(PROMPT(f), { label: `dossier:${f.id}`, phase: 'Research', schema: DOSSIER_SCHEMA })))

const done = results.filter(Boolean)
log(`${done.length}/${args.features.length} dossiers returned`)
return { dossiers: done, missing: args.features.filter((f, i) => !results[i]).map(f => f.id) }
```

- [ ] **Step 3:** While the workflow runs (or after), for each returned dossier write `docs/FEATURES/cards/<id>-<slug>.md` using the spec-§5 card template: header line (Domain / Lab status from tracker / build-seq Phase), §§1–6 from the dossier fields verbatim, then the `────` divider and an empty §7. Spot-check 3 cards' reference URLs with WebFetch (no-invented-urls audit) before committing.
- [ ] **Step 4:** If `missing` is non-empty, re-run the workflow with only those features in `args` (same script — resume caching keeps completed agents free).
- [ ] **Step 5:** Update tracker Phase-status row 1 → ✅, Phase 2 → ▶️.
- [ ] **Step 6:** Commit:

```bash
git add docs/FEATURES/cards/ docs/FEATURES/planet-lod-campaign-tracker.md
git commit -m "campaign phase 1: 48 research dossier cards"
```

- [ ] **Step 7:** Flip `~/.claude/state/dev-collab/active-workstream.json` well-dipper key to `planet-refinement-campaign` (execution has begun) and note it in `docs/NOW.md`.

### Task 7: Phases 2–7 — the /goal chain (Max-driven)

No file edits in this task — the launch cards in the tracker (Task 5) ARE the deliverable. Operating rules for working-Claude inside each goal turn:

- **Pickup:** tracker → phase table → first unverdicted card. One feature (or check/row) per turn-cluster; commit before moving on.
- **Judging (spec §13.3):** solo per card §5 → `take_screenshot` with `filePath` into `docs/FEATURES/cards/shots/` (locked naming) at 2–3 distances → visually compare against card §3 refs → check shader math vs card §4 → objective checks via `window.__wd.*`/pixel readback → verdict to card §7, rating to tracker.
- **Heavy loop (spec §13.4):** card §6.5 build plan → implement via subagent → code-review subagent → verify → commit. Reuse the F11 spike lesson for fluvial work (drainage = tributary-octave apron-gated `max()` union, NOT zero-band of warped noise — see `memory/well-dipper-lod-terrain-campaign.md`).
- **Forks:** technical → decide + log in card. Taste → conservative option + `taste-call` mark. Both surface in Phase 7.
- **Stalls:** usage-limit pause = wait, goal resumes. Evaluator nags about an unmet condition you believe is met → print the proving command output again (the evaluator only sees the transcript).
- **Phase 7:** assemble `docs/FEATURES/REVIEW-LAP.md` — ordered card links, `\\wsl.localhost\Ubuntu\home\ax\projects\well-dipper\docs\FEATURES\cards\shots\...` Windows paths for galleries, every parked/taste-call/F38/F39 item as a decision list. Walk Max through it; overruled verdicts re-enter a light loop; then cards flip `VERIFIED_PENDING_MAX → shipped`.

---

## Execution order summary

1. Tasks 1–5 (apparatus, ~30 min, doc-only) — this session or next.
2. Task 6 (Phase 1 workflow) — same session as Tasks 1–5 if budget allows.
3. Max types Phase-2 `/goal` (fresh session) … through Phase-6, one fresh session each.
4. Phase 7 review lap with Max.
