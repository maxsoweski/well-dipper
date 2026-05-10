# Workstream: Ship Scanner (2026-05-09)

**Slug:** `ship-scanner-2026-05-09`
**Status:** PM-scoped (proxy authoring). GATE 1 greenlit by Max in this session.
**Predecessors:** `reticle-ghosting-fix-and-ui-overlay-inspection-2026-05-09` (paused at `8c290e0`, awaiting Tester sign-off).

## Why

Ships exist in well-dipper systems (1-3 per planet, 50% chance per planet → up to ~15 per system). Per `ShipSpawner.js` they render at realistic hull-length scale (Game Bible §10), so they appear sub-pixel from typical orbit distances and are effectively invisible. The spawner's docstring names "ship billboard / periscope magnifier" as the planned UX path; this workstream delivers a near-equivalent: a scanner mode that surfaces ships as click-selectable, burn-able targets.

Max's framing (verbatim): "I want to assign that to a key bind so that when I press it reticles for ships appear. And we can make this happen such that if none are in screen space you get a little arrow directing you off-screen space until you actually get it into screen space. And then if you click to lock on just like with any planet or moon or star in the system you can lock on and then burn for the ship and then it'll carry you right up until the ship is filling up as much of the screen space as a planet would."

## What

Four coupled units, decomposed for per-unit unit + integration + Max UAT cycles:

### Unit 1 — Scanner toggle + on-screen ship reticles
- Alt-tap toggles scanner mode (sticky on/off).
- When mode is ON, every ship in the active system whose mesh is within the camera frustum gets a ship reticle drawn over its projected position.
- Ship reticles use the existing bracket geometry but with a distinct color (cyan or amber, working-Claude picks a value that reads against the green body reticles).
- TargetingReticle accepts a new `shipTargets` array passed via `update()`. Existing planet/moon/star draw paths unchanged.
- Inspection layer surfaces ship reticles as `ui.reticle.ship.<archetype>.<index>` mesh entries (synthetic, source: 'ui').

### Unit 2 — Off-screen ship indicators
- For each ship in scanner mode whose projected position is outside the viewport, render a small arrow at the viewport edge pointing toward the ship.
- Arrow position math: project the ship to NDC; if outside [-1, +1], clamp to viewport edge along the line from viewport center to ship NDC.
- Optional: arrow includes ship name or archetype if cursor is hovering near it (deferred unless trivial).

### Unit 3 — Ship-as-target click selection
- `hitTestBodies` returns a target with `kind: 'ship'` when the click lands within a ship reticle's hit area (use bracketHalf as the hit radius).
- The shared `selectTarget` / `_selectedTarget` pipeline accepts ships. The selected ship gets the `state: 'selected'` reticle treatment in scanner mode AND in normal mode (a ship that's been selected stays visible-as-selected even after scanner toggles off, until deselected).
- Tentative (hover) state for ships in scanner mode is OPTIONAL — recommend implementing for parity with body reticles.

### Unit 4 — Burn-to-ship with close-up arrival framing
- The existing burn system (autopilot manual burn) is invoked when Max presses Space (or clicks the BURN button) with a ship selected.
- Arrival distance: compute the distance at which the ship's hull length subtends ~45° of view ("very big" close-up framing per Max's UAT 2026-05-09; original spec called for 5° / planet-equivalent which felt too small in practice). Formula: `distance = hullLengthMeters / (2 * tan(22.5° in radians))` × scene-unit conversion factor.
- The burn camera trajectory adapts to the new distance — ship dominates view at arrival.

## Acceptance Criteria

| # | AC | Unit | Test layer |
|---|----|------|-----------|
| 1 | Alt-tap toggles `_shipScannerMode` flag (boolean). Tap once → ON; second tap → OFF. State persists until next toggle or page reload. | 1 | Integration via key dispatch + state inspection. |
| 2 | When `_shipScannerMode === true` AND a ship is in viewport, `__wd.takeSceneInventory().meshes` contains a `ui.reticle.ship.<archetype>.<index>` entry with `state: 'tentative'` (or `'selected'` if selected) and screen-space coordinates within ±2 px of the ship's projected position. | 1 | Integration: `__wd.runShipScannerInspectionTests()` toggles mode, asserts entries appear. Unit (kit-side): inventory shape test. |
| 3 | When `_shipScannerMode === false`, no `ui.reticle.ship.*` entries appear in inventory. Existing body reticles continue to behave unchanged. | 1 | Integration assertion. |
| 4 | When `_shipScannerMode === true` AND a ship is OUTSIDE viewport, an off-screen indicator entry appears in inventory: `ui.reticle.ship-offscreen.<archetype>.<index>` with `screenSpace` clamped to viewport edge and an `arrowAngle` field (radians, 0 = right) pointing from viewport center toward the ship. | 2 | Integration: drive camera off-axis, assert entries. Unit (kit-side): clamp + angle math. |
| 5 | Clicking within `bracketHalf + 8 px` of an in-viewport ship reticle's center selects that ship. `_selectedTarget.kind === 'ship'`. The reticle entry's `state` flips from `'tentative'` to `'selected'`. | 3 | Integration: synthetic click + selection assertion. |
| 6 | A ship that has been selected remains selected after toggling scanner mode OFF; its reticle stays visible. Toggling scanner OFF does NOT deselect a selected ship. | 3 | Integration. |
| 7 | Pressing Space (or clicking BURN button) with a ship selected initiates the manual burn. The burn target distance is computed from ship hull length such that ship subtends ~45° at arrival. | 4 | Integration: telemetry assertion that burn initiated, target distance within tolerance of the formula. Unit: distance calculation across hull length range (10m → 500m). |
| 8 | At burn arrival, ship's projected angular size is between 40° and 50° (allowing tolerance around the 45° target). Camera-to-ship distance is stable (variance < 10% over 1s). | 4 | Integration: post-burn telemetry — `runShipScannerBurnArrivalTest` asserts apparent angular size + variance. Max UAT: visual confirmation that ship dominates the view at arrival and appears stationary as camera tracks ship orbital motion. |
| 9 | Existing `__wd.runIntegrationSuite()` (19/19) and `__wd.runPhaseATests()` (11/11) continue to PASS. `__wd.runReticleInspectionTests()` (6/6) continues to PASS — scanner-mode entries are additive. | 1-4 | Integration regression. |
| 10 | Production-bundle drift guard (`scripts/check-prod-no-inspector.sh`) still PASSes — scanner integration tests are dev-only. Scanner mode itself ships in production. | 1-4 | Build-time. |
| 11 | Max UAT GATE 3 per unit: tap Alt, see reticles → select a ship → see selection indicator → press Space → ride the burn → ship fills view at arrival. Smooth and felt-experience-correct. | 1-4 | UAT, Max's hands. |

## Out of scope

- Ship-internal name resolution (per-vessel name strings beyond archetype + index). Names display as `<ARCHETYPE> <INDEX>` (e.g., "FIGHTER 3"). Bespoke ship names route to a future workstream.
- Ship combat / interaction beyond burn-and-arrive.
- Ship orbit visualization (orbit lines for ships) — they orbit planets but no orbit lines drawn.
- Targeting reticle redesign — keep existing bracket geometry, just different color for ships.
- Scanner UI HUD elements (status text, scanner sound effect, animation on toggle) — minimum viable for now.
- Multi-ship selection — single-target burn matches existing body burn behavior.

## Drift risks

- **Burn system assumptions broken.** The autopilot burn was tuned for planet-scale targets. A 50m ship arrival distance is roughly 1100m — orders of magnitude smaller than typical planet arrivals. Risk: camera physics, deceleration profile, or arrival-detection thresholds may misbehave. **Mitigation:** Unit 4's integration test asserts arrival framing; if burn breaks, scope the burn-tuning fix in-stream OR carve it into a follow-up workstream depending on size.
- **Hull length scaling drift.** `shipHullToScene(archetype)` (from `ScaleConstants.js`) returns the scene-unit scale for ship models. Need to multiply by the ship model's native hull length to get scene-unit hull length for distance math. Verify the relationship at execution time before baking into the formula.
- **Hit-test radius too generous.** If ship reticles overlap with body reticles spatially (e.g., a ship orbiting close to a planet), `hitTestBodies` needs a priority order (recommend: closest-to-camera wins). May surface integration test failures we'd handle in-stream.
- **Camera occlusion logic.** `_isReticleOccluded` checks if a target is behind another body. Ships should probably NOT be occluded by their parent planet (otherwise they'd never show in scanner mode while orbiting). Resolution: ships skip occlusion check when scanner mode is active.
- **Off-screen indicator clutter.** With up to 15 ships per system, off-screen arrows could pile up at viewport edges. **Mitigation:** dedupe by direction (cluster nearby ships into one arrow with a count badge) — or accept clutter for V1, refine later.

## Per-unit execution loop

Working-Claude iterates through Units 1 → 2 → 3 → 4 autonomously. For EACH unit:

1. Implement the unit.
2. Write/extend unit tests (kit-side where applicable).
3. Write/extend integration tests (`__wd.runShipScannerInspectionTests()`).
4. Verify both unit + integration tests PASS via chrome-devtools at `localhost:5174/well-dipper/?lab=1`.
5. Take a visual screenshot exercising the unit (visual QA gate satisfaction).
6. Commit the unit.
7. Advance to next unit.

If unit OR integration tests FAIL during a unit, working-Claude triages and iterates WITHIN that unit until both pass before advancing. No mid-feature handoff to Max for UAT.

**Once Units 1-4 ALL pass unit + integration tests:**

8. Hand off to Max for end-to-end UAT (single demo covering all 4 units' acceptance criteria).
9. On Max UAT pass → `Agent(subagent_type="tester")` for Shipped-gate verdict.
10. On Tester PASS → append `Shipped <sha>` to this brief's Status section.
11. Push origin master; verify deploy.

If Max UAT surfaces issues, route to in-feature fix (re-loop the affected unit) before re-advancing to Tester.

## Handoff

**Active workstream pointer:** to be set immediately after this brief is committed.

**Tester invocation after final unit:** `Agent(subagent_type="tester")` with brief path = this file. Verdicts append to `~/.claude/state/dev-collab/tester-audits/ship-scanner-2026-05-09.md`.

**Push-on-shipped:** well-dipper is established-deploy. Per `feedback_push-on-shipped.md`.

---

**PM-proxy authoring note (2026-05-09):** Authored by working-Claude as PM-proxy because the `pm` subagent type is not registered in this harness. Greenlit inline by Max via AskUserQuestion before brief authoring; per-unit decomposition reflects his explicit choice "include your unit, then integration testing for each of these units in the feature, then I'll UAT after you've successfully iterated through this process for each of the units in the feature."

## Status

**Shipped `30aa1cf` — 2026-05-10.** Tester PASS at `30aa1cf` covering the four units + three UAT-round revisions (rotation/lighting/idle-lock fixes, ship-lock with drag-rotate). Max UAT GATE 3 confirmed end-to-end: scanner toggle, on-screen reticles, off-screen indicators, click-select + burn, ship-lock (camera follows ship's local frame so ship appears stationary), drag-rotate within ship-lock. Burn-arrival telemetry: apparent angular size 45.00° (target 45°), camera-to-ship distance variance 0% (std 5.989e-15) over 1s. All sibling suites green: reticle inspection 6/6, Phase A 11/11, integration 19/19. AC7 (formula-correct burn init), AC8 (arrival framing + stability), AC11 (Max felt-experience UAT) all satisfied.
