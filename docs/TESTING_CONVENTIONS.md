# Testing conventions — well-dipper

Project-specific instance of the system-wide template at `~/.claude/agents/templates/TESTING_CONVENTIONS.md`. Names what unit / integration / UAT mean for well-dipper and points at the existing infrastructure.

## Project: well-dipper

### Stack
Vite + Three.js (vanilla JS, ES modules). Vendored `motion-test-kit` submodule at `vendor/motion-test-kit/` for shared testing infrastructure (predicates, recorders, scene-inventory adapter, fnv1a hash). Deployed to GitHub Pages (`wow.pjh.is/well-dipper/`) on every push to master.

### Visible behavior?
**Yes.** Real-time procedural-galaxy renderer with warp transitions, autopilot, lab mode. Visual + felt-experience criteria load-bearing for any user-facing change. UAT applicable for runtime-behavior workstreams; N/A for kit-internal / pure-doc workstreams.

---

## Layer definitions

### Unit
**Scope:** smallest possible scope; internal to the code; deterministic; no scene state.

**Mechanism:** vitest in well-dipper proper. `node:test` in vendored kit (run from kit directory).

**Run:**
- Well-dipper unit suite: `npm test` (from `~/projects/well-dipper/`).
- Kit unit suite: `cd vendor/motion-test-kit && npm test` (or `cd ~/projects/motion-test-kit && npm test` if working in the kit repo directly).

**Lives at:**
- Well-dipper: `tests/*.test.js` (vitest).
- Kit: `vendor/motion-test-kit/tests/*.test.js` (node:test).

**Examples:**
- Hash bit-stability: `motion-test-kit/tests/hash.test.js` pins `fnv1aString('12345:0') → '8066189e'`. Refactor of fnv1a fails loudly.
- Inventory predicates: `motion-test-kit/tests/inventory-predicates.test.js` exercises every predicate's PASS / FAIL / missing-field paths.
- Scene-inventory adapter: `motion-test-kit/tests/scene-inventory*.test.js` exercises traversal, frustum math, multi-scene tagging.
- KnownObjects / GalacticFeatures: `src/generation/__tests__/*.test.js` (vitest).

**When to add:** any new pure function, predicate, math helper, parser, data-transformation utility, or generator that returns a deterministic value from inputs.

### Integration
**Scope:** biggest possible scope; exercises the full app through real or simulated input; deterministic when seeded.

**Mechanism (current):**
- **In-session smoke test:** `__wd.runIntegrationSuite()` from the dev browser console. 19 tests. Verifies naming taxonomy, multi-scene tagging, all 9 inventory categories, predicate library, golden serialization. <2s.
- **Warp lifecycle:** `__wd.runWarpSuite()` drives a warp via `_beginWarpTurn()` while sampling at 100ms cadence. Reports layer-functionality PASS/FAIL + regressions[]. ~14s.

**Mechanism (queued — Phase 0 of testing-framework upgrade):**
- **Recording-replay against committed goldens.** Per `feedback_input-record-replay-integration.md`. Kit already has `createInputRecorder` + `createInputPlayer`; well-dipper uses them at `src/core/InputReplay.js` for determinism but not yet for integration testing. Future shape: 3-5 canonical recordings at `tests/recordings/canonical/<scenario>.json` + end-state goldens at `tests/golden/scene-inventory/<scenario>.json`. Replay → assert end-state diff is empty.

**Run:**
- In-session: load Sol → `await __wd.runIntegrationSuite()` from console.
- Warp: `await __wd.runWarpSuite()` (heads-up: ~14s + visible warp animation).
- Recording-replay (queued): TBD command via `node tests/replay-canonical.mjs` once Phase 0 ships.

**Lives at:**
- Test plan: `docs/testing/scene-inspection-integration-tests.md` (Groups A-I).
- Runners: `src/debug/integration-suite.js` (wired to `__wd`).
- Future recordings: `tests/recordings/canonical/`.
- Future goldens: `tests/golden/scene-inventory/` (scaffold present; no goldens captured yet).

**Goldens:** committed at `tests/golden/scene-inventory/`. Generated via `__wd.saveGolden(scenarioName)` (downloads JSON; Max moves to repo). Diff via kit's `diffInventories` or `__wd.quickGoldenDiff`.

**When to add:** any feature spanning multiple subsystems (state machine + rendering, generator + renderer, sky + main scene, warp + skyRenderer crossover). The single-file unit test is insufficient.

### UAT (conditional — applicable for visible-behavior workstreams)

**Mechanism:** chrome-devtools `press_key` / `click` driven by Tester subagent for structural verification, then Max in his real browser (port 5174 dev server, real RTX 5080) confirms felt-experience.

**Felt-experience handoff:** Tester PASSes structurally; Max GATE 3 confirms in real environment. The framework's "PASS — UAT deferred to Max" verdict is the explicit handoff.

**Concrete examples:**
- Visual layout / typography (Shift+I inspector panel sizing, color palette, JSON-tree expansion ergonomics).
- Motion smoothness (warp transition feel, autopilot tour easing).
- Cinematic continuity (does the warp tunnel look right entering vs exiting).
- Game-feel / juice (does pressing Shift+1 land in scenario 1 with the right energy).

**When N/A within well-dipper:**
- Pure-refactor workstreams. Telemetry-equivalence per `docs/REFACTOR_VERIFICATION_PROTOCOL.md`; no Max-eyes step beyond reading the diff.
- Doc-only workstreams (Bible updates, persona edits, workstream brief authoring).
- Internal kit-side improvements when nothing user-facing changes.

**PM asks per workstream:** *"Does this touch the user-facing surface — visual rendering, input responses, audio, motion, layout? If yes, UAT relevant. If no, UAT N/A."*

**Existing UAT mechanism details:**
- Dev server: `npm run dev` in WSL. Default port 5174 (5173 often taken).
- Real Chrome: Max's RTX 5080 + native browser at `http://localhost:5174/well-dipper/`.
- Chrome:9223 (second Chrome instance for chrome-devtools MCP): launched per `chrome-devtools-9223-launch.md`. Same real-GPU output; lets Tester drive autonomously per `feedback_drive-ac-checks-via-chrome-devtools.md`.
- Lab-mode: `?lab=1` URL flag + Shift+1..7 scenario keybinds.
- Audio mute for dev sessions: `localStorage.setItem('well-dipper-settings', JSON.stringify({masterVolume: 0}))` per `feedback_default-mute-audio-in-dev.md`.

---

## Tester verdict shape

Per `docs/PERSONAS/tester.md` §"Evidence reviewed (per layer)" + §"Verdict (per layer)". Per-layer block:

```
**Unit:** PASS | FAIL | N/A (rationale)
**Integration:** PASS | FAIL | N/A (rationale)
**UAT:** PASS | deferred to Max | N/A (rationale)
```

Followed by overall verdict line. Specific to well-dipper, the typical outcome for a visible-behavior workstream is `Unit: PASS / Integration: PASS / UAT: deferred to Max`.

---

## Carve-outs

**Felt-experience-only criteria** (e.g., "warp tunnel feels cinematic"): Tester verdict says `UAT: deferred to Max`. No structural verification can replace Max's eyes here.

**Performance budgets** are an integration concern in well-dipper. `rendererInfo.drawCalls` and `rendererInfo.triangles` are captured in the inventory. Goldens for canonical scenarios commit baseline values; integration tests assert ±10% via kit's `drawCallBudget` + `triangleBudget` predicates.

**The two parked regressions** (`warp-tunnel-second-half-not-rendering`, `reticle-persists-after-warp`) are auto-detected by `__wd.runWarpSuite()` via the regression-detection-as-diagnostic pattern (per `feedback_pass-fail-vs-diagnostic.md`). They will become unit + integration assertions once a triage workstream lands fixes.

---

## Cross-references

- `~/projects/well-dipper/docs/PERSONAS/pm.md` §"Test Coverage Plan" — the brief-template section.
- `~/projects/well-dipper/docs/PERSONAS/tester.md` §"Evidence reviewed (per layer)" — the verdict shape.
- `~/projects/well-dipper/docs/testing/scene-inspection-integration-tests.md` — pass/fail catalog for the inspection layer.
- `~/projects/well-dipper/docs/testing/scene-inspection-demo-walkthrough.md` — Max-paced demo of the inspection-layer features.
- `~/projects/motion-test-kit/runbooks/06-scene-inventory.md` — kit-side technique reference.
- `~/.claude/projects/-home-ax/memory/feedback_three-layer-test-coverage.md` — the rule.
- `~/.claude/projects/-home-ax/memory/feedback_pass-fail-vs-diagnostic.md` — composes with layer-classification.
- `~/.claude/projects/-home-ax/memory/feedback_input-record-replay-integration.md` — canonical integration mechanism (queued for Phase 0).
- `~/.claude/projects/-home-ax/memory/feedback_test-actual-user-flow.md` — UAT mechanism (real keypress / click).
- `~/.claude/projects/-home-ax/memory/feedback_drive-ac-checks-via-chrome-devtools.md` — autonomous UAT verification when dev server is up.
