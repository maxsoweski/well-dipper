# Workstream: scene-inspection layer UAT (2026-05-07)

First real workstream under the new three-layer testing framework (`feedback_three-layer-test-coverage.md`). Formally closes UAT on the inspection-layer features that shipped with Tester PASS T1-T4 but pending Max-eyes verification.

## Why we care

The scene-inspection layer is the leverage tool for every future runtime-behavior workstream in well-dipper — the inspector panel, `__wd` console surface, runIntegrationSuite, runWarpSuite, golden snapshots all built to make scene state observable so Claude (and Max, secondarily) doesn't have to bottleneck on screenshots and visual guessing. It shipped at well-dipper master `c24d3f1` with structural Tester PASS, but until Max has actually USED the features interactively, we don't know whether they earn their keep day-to-day or just look reasonable on paper.

This workstream closes that gap. Six items, one at a time, strict-sequential. Outcome: either the layer is Shipped end-to-end OR specific UAT-detected defects get filed as follow-up workstreams.

It also serves as the first real exercise of the three-layer testing framework (`dev-collab-three-layer-testing-2026-05-07`). Validates the new shape on real material rather than abstract.

## Current objective + success criteria

**Objective:** Each of the six pending-UAT items in `well-dipper-progress.md` "PENDING MAX UAT" section gets explicitly verified by Max in his real Chrome at `localhost:5174/well-dipper/`, with findings recorded.

**Success criteria (in Max's language):**

1. **Demo walkthrough end-to-end.** Max runs all 10 demos in `docs/testing/scene-inspection-demo-walkthrough.md`. Each demo's expected output matches actual output OR a defect is recorded. Working-Claude tracks defects mid-walkthrough; resumes after fix per strict-sequential discipline.
2. **Shift+I panel UX.** Max opens the panel during a real session, evaluates layout / typography / color palette / position-on-screen / JSON-tree expansion / copy-to-clipboard ergonomics. Reports specific friction points. Cosmetic defects logged as a follow-up polish workstream; blocking defects (panel doesn't render, breaks canvas focus) fixed in-line.
3. **`runWarpSuite()` felt experience.** Max watches the visible warp animation while the 100ms sampler runs. Confirms: warp visual fidelity unchanged vs. running without sampler; phase transitions captured without missing any; the suite's reported regressions match what Max visually observes.
4. **`saveGolden()` workflow.** Max runs `__wd.saveGolden('sol-default-camera')` from console. Moves the downloaded JSON to `tests/golden/scene-inventory/sol-default-camera.json`. Commits. Re-runs `__wd.quickGoldenDiff` against the committed golden on a fresh snapshot. Confirms the workflow feels usable.
5. **Triage one parked regression with the layer.** Max picks `reticle-persists-after-warp` (simpler than the warp-tunnel one). Uses `__wd.getNamed('effect.warp.landing-strip')` + console samplers + Shift+I panel to investigate why the strip persists post-warp completion. **Bug fix is OUT OF SCOPE** — investigation only. Outcome: either the layer surfaced enough information to scope the fix (PASS — file the triage workstream) OR the layer is insufficient (PASS with caveat — file gaps as follow-up).
6. **Dev-workflow self-report.** After items 1-5, Max writes a one-paragraph reflection: did `__wd.<x>` calls shorten his iteration cycle in real debugging? Are there friction points? Items 1-5's specific defects roll up here as a final summary.

## Architectural connections

### Inputs (what this consumes)

- **The inspection-layer features themselves.** All six items exercise the `__wd` surface, the Shift+I panel, suite runners, golden helpers, drift guard. Documented inventory at `well-dipper-progress.md` 2026-05-07 "PENDING MAX UAT" section.
- **Demo walkthrough doc** at `docs/testing/scene-inspection-demo-walkthrough.md` — drives item 1.
- **Integration test plan doc** at `docs/testing/scene-inspection-integration-tests.md` — reference for what each demo proves.
- **Live engine at `localhost:5174/well-dipper/`** — Max's real Chrome with RTX 5080. Dev server already running per session setup.
- **Chrome:9223** — second Chrome for chrome-devtools MCP per `feedback_drive-ac-checks-via-chrome-devtools.md` (working-Claude can drive setup snippets, Max evaluates felt-experience in his real Chrome window).

### Outputs (what depends on this)

- **Triage workstream for the two parked regressions** (`reticle-persists-after-warp`, `warp-tunnel-second-half-not-rendering`). Item 5 produces the scoping data for `reticle-persists-after-warp`'s triage; the warp-tunnel one stays parked until a separate item picks it up.
- **Phase 0 of testing-framework upgrade roadmap** (record-replay integration). UAT confirms whether the in-session `runIntegrationSuite` pattern is OK as-is or needs the record-replay rebuild for daily use.
- **Polish workstream(s)** — UAT-detected cosmetic defects (Shift+I panel typography, etc.) become follow-up scoped briefs.
- **Validation of the new three-layer testing framework** (`dev-collab-three-layer-testing-2026-05-07`). First real workstream using the new shape.

### Features that must stay working

- All existing well-dipper functionality. UAT involves running the game, driving warps, observing rendering — any visible regression in core gameplay (warp tunnel breaking outside the parked regression, autopilot freezing, splash dismiss not working) blocks UAT progress.
- The dev-collab-gate hook + three-Max-gate loop. This workstream is the first exercise of the new framework; if the loop misfires (e.g., gate state desyncs, Tester verdict shape parses wrong), block + diagnose.

## Test Coverage Plan

Per the new three-layer framework. Project conventions per `docs/TESTING_CONVENTIONS.md`. UAT applicable for visible-behavior workstreams (which this is — all six items involve Max's eyes on the live game).

| AC | Unit coverage | Integration coverage | UAT coverage |
|---|---|---|---|
| 1 Demo walkthrough end-to-end | N/A — no new code | Each demo snippet IS a small integration test against the live engine at that moment (10 slices). Verifies `__wd` API matches live scene state across rendering pipeline / warp state / autopilot / sky / system data integration. | Max walks demos 1-10, reports any execution mismatch + felt-experience oddness. Strict-sequential — block on any blocking defect. |
| 2 Shift+I panel UX | N/A | Panel renders alongside canvas without blocking input; copy-to-clipboard reaches OS clipboard; toggle doesn't leak DOM. Verified by Max-driven interaction. | Max opens panel during real session, evaluates layout / typography / color palette / ergonomics. Cosmetic → follow-up polish; blocking → in-line fix. |
| 3 `runWarpSuite()` felt experience | N/A | 100ms sampler doesn't cause visible stutter; phase transitions captured without missing any; warp completes identically with vs without sampler running (compare distinctPhases array against Max's eyes). | Max watches warp animation while suite runs; confirms visual fidelity matches Max's expectation of warp behavior. |
| 4 `saveGolden()` workflow | N/A | Download anchor fires; JSON file parses; serializeForGolden output is canonical (UUIDs stripped, positions rounded, arrays sorted) and stable run-to-run; quickGoldenDiff against committed baseline returns empty diff on identical state. | Max runs the workflow once for `sol-default-camera`, commits the golden, re-runs diff, confirms ergonomics. |
| 5 Triage one parked regression | N/A | `__wd.getNamed` returns Object3D refs that ARE the live scene objects (mutating via console reflects in render); samplers stay in lockstep with real warp state during gameplay. | Max uses `__wd.getNamed('effect.warp.landing-strip')` + samplers to investigate why landing-strip persists post-warp. Investigation only — bug fix scoped as separate triage workstream. PASS = layer was sufficient OR insufficient; either outcome is valid framework data. |
| 6 Dev-workflow self-report | N/A | N/A — closing self-assessment | Max writes 1-paragraph reflection. File any gaps as follow-up workstreams. |

## In scope

- Sequential execution of items 1-6.
- **Defects classified by LAYER, not severity** (per Max's correction 2026-05-07, captured in `feedback_layer-routes-defect-resolution.md`):
  - **Unit-layer defects** (test missing, test wrong, build broken) → working-Claude fixes in-stream when within ability. Affected item re-verifies before moving to next.
  - **Integration-layer defects** (suite captures wrong data, predicate misclassifies, doc snippet's expected output is misleading) → working-Claude fixes in-stream when within ability. Same re-verify rule.
  - **UAT-layer defects** (felt-experience friction — typography too small, motion too slow, ergonomics weird) → log for follow-up workstream + continue. These need Max's judgment; in-stream fixing risks Claude making cosmetic decisions Max didn't sanction.
  - **Blocking defects regardless of layer** → pause workstream, scope a fix workstream, resume after fix lands.
- Findings written into Tester verdict's "Summary for Max" section per item.

## Out of scope

- **Fixing `reticle-persists-after-warp`.** Item 5 is investigation only. The fix is a separate triage workstream PM-scoped after this workstream's item 5 completes — the investigation findings inform the triage scope. **RECORDED HERE EXPLICITLY for tracking:** the next workstream after this one (or in parallel, depending on priority) is `welldipper-triage-reticle-persists-after-warp-<date>`. Same shape rule for `warp-tunnel-second-half-not-rendering` if/when prioritized.
- **Building Phase 0 record-replay integration.** That's a separate workstream from the testing-framework upgrade roadmap. UAT may inform whether record-replay is high-priority or deferable, but the work itself is out of scope here.
- **Fixing UAT-detected cosmetic defects in-line.** Cosmetic = follow-up; blocking = in-line. PM judges per defect.
- **Updating the inspection-layer features themselves to add new capabilities.** UAT is verification only. New capabilities = new workstream.

## Drift risks

### Risk 1 — UAT becomes a paper exercise

If working-Claude over-narrates each item's setup and Max passively reads the demo doc instead of actually running snippets in his console, the UAT layer is theatre. Tester PASS would be cosmetic.

**Why it happens:** verifying-by-reading is faster than verifying-by-doing.

**Guard:** working-Claude pauses BETWEEN items + does NOT advance until Max reports findings from his actual console / browser. Max GATE 3 per item is mechanical. If Max says "looks fine, continue" without specific findings, working-Claude prompts: *"What did you see when you ran X?"*

### Risk 2 — Strict-sequential discipline lost on multi-defect items

Item 1 has 10 demos; if demo 3 fails and demo 7 also fails, strict-sequential means: fix demo 3, re-verify, then move on; defer demo 7 until reached.

**Why it happens:** parallelism feels efficient but breaks the "one defect at a time" contract.

**Guard:** PM persona's strict-sequential rule applies item-by-item AND demo-by-demo within item 1. Working-Claude tracks the "currently working" demo number; doesn't move past it until resolved or explicitly deferred.

### Risk 3 — Item 5 turns into a triage workstream mid-stream

Max uses the layer to investigate the regression, finds the cause, and is tempted to fix it right there. That's scope creep into a separate workstream's territory.

**Why it happens:** "I see the bug, I know how to fix it, just let me fix it."

**Guard:** PM persona records the bug-fix-is-separate rule explicitly in the §"Out of scope" section above. If Max wants to fix in this workstream, he can request scope expansion explicitly; otherwise, the fix becomes the triage workstream's job. Working-Claude flags scope creep at point-of-fix.

### Risk 4 — Test Coverage Plan reads as ceremonial because Unit + Integration are mostly N/A

This is a UAT-heavy workstream. Five items have Unit: N/A, three have Integration as "implicit in UAT execution." The table form may feel forced.

**Why it happens:** the new framework's table assumes typical workstreams have all three layers populated. UAT-only workstreams are a special case.

**Guard:** the conditional rule in `feedback_three-layer-test-coverage.md` allows "N/A — rationale" entries explicitly. The table here uses them honestly. If Max finds the table form awkward in this case, that's UAT-on-the-framework-itself feedback (item 6 territory) — file as a follow-up to refine the framework, don't paper over.

### Risk 5 — Defects discovered during UAT cascade

Cosmetic Shift+I panel issue at item 2 might bleed into item 4's saveGolden visual UX. Max might want to fix one before evaluating the next.

**Why it happens:** the layer's visual surfaces share rendering / styling.

**Guard:** strict-sequential per item. If item 2 surfaces a cosmetic defect that affects item 4, log it; complete item 2; complete item 3 (warp); then re-evaluate item 4 with the cosmetic defect in mind. The defect log carries forward.

## Handoff to working-Claude

Read order:
1. This brief end-to-end.
2. `well-dipper-progress.md` "PENDING MAX UAT" section (the source list of 6 items).
3. `docs/testing/scene-inspection-demo-walkthrough.md` (item 1's reference).
4. `feedback_three-layer-test-coverage.md` (the framework being exercised).
5. `feedback_drive-ac-checks-via-chrome-devtools.md` (autonomous-verification rule when dev server is up).
6. `feedback_test-actual-user-flow.md` (real keypress > synthetic).

Strict-sequential discipline. After each item, working-Claude:
- Reports what was set up + what Max needs to do.
- Pauses. Awaits Max's findings.
- Records findings in the item's row of a working defects log.
- Greenlight from Max → next item.

Tester invoked at the END of all 6 items, NOT per item. The verdict aggregates findings across the workstream. Per-layer verdict will be `Unit: N/A / Integration: PASS (or FAIL with specific defects) / UAT: PASS or PASS with caveats`.

If a blocking defect surfaces mid-item, working-Claude:
- Pauses item.
- Briefs Max on the defect + proposed fix scope.
- If trivial (typo, single-line CSS): fix in-line + re-verify.
- If non-trivial: pause workstream, scope a fix workstream, resume after fix lands.

Done state: all 6 items have a recorded UAT outcome. Tester verdict is composed. Workstream flips to Shipped end-to-end OR Shipped-with-known-deferrals (cosmetic defect follow-ups filed).
