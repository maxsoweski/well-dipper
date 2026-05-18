# Test harnesses + conventions — Well Dipper

Consolidated from pre-v5 `CONVENTIONS_test-harnesses.md` +
`TESTING_CONVENTIONS.md` + `TESTING_CONVENTIONS_TEMPLATE.md` (now
archived). This is the canonical convention doc for what unit /
integration / UAT mean in well-dipper, and the visual-lab harness
pattern for shader / rendering work.

## Stack context

Vite + Three.js (vanilla JS, ES modules). Vendored `motion-test-kit`
submodule at `vendor/motion-test-kit/` for shared testing infrastructure
(predicates, recorders, scene-inventory adapter, fnv1a hash). Deployed
to GitHub Pages on every push to master.

## Three-layer test coverage

Per `feedback_three-layer-test-coverage.md` (Claude memory; updated
2026-05-08). Each layer defined for well-dipper:

### Unit

**Scope:** smallest possible scope; internal to code; deterministic;
no scene state.

**Mechanism:**
- Well-dipper: vitest (`tests/*.test.js`, `src/**/__tests__/*.test.js`)
- Kit: node:test (`vendor/motion-test-kit/tests/*.test.js`)

**Run:** `npm test` from `~/projects/well-dipper/`; for kit:
`cd vendor/motion-test-kit && npm test`.

**When to add:** any new pure function, predicate, math helper, parser,
data-transformation utility, or generator that returns a deterministic
value from inputs.

### Integration

**Scope:** biggest possible scope; exercises the full app through real
or simulated input; deterministic when seeded.

**Mechanism (current):**
- **In-session smoke test:** `__wd.runIntegrationSuite()` from dev
  browser console. ~19 tests; verifies naming taxonomy, multi-scene
  tagging, all 9 inventory categories, predicate library, golden
  serialization. <2s.
- **Warp lifecycle:** `__wd.runWarpSuite()` drives a warp via
  `_beginWarpTurn()` while sampling at 100ms cadence. Reports
  layer-functionality PASS/FAIL + regressions[]. ~14s.

**Mechanism (queued):** Recording-replay against committed goldens.
Future shape: 3-5 canonical recordings at
`tests/recordings/canonical/<scenario>.json` + end-state goldens at
`tests/golden/scene-inventory/<scenario>.json`. Replay → assert
end-state diff is empty.

**Run:** In dev browser console after loading Sol →
`await __wd.runIntegrationSuite()`. Warp: `await __wd.runWarpSuite()`
(~14s + visible warp animation).

**When to add:** any feature spanning multiple subsystems (state
machine + rendering, generator + renderer, sky + main scene, warp +
skyRenderer crossover).

### UAT (Max-driven; only Max counts as UAT)

**UAT presupposes integration is GREEN.** UAT is for ergonomics /
navigation / workflow of features whose integration has confirmed
FUNCTIONAL — not for catching feature bugs. If integration reports
regressions for the SUT, UAT is BLOCKED.

**Mechanism:** Max in his real browser at
`http://localhost:5174/well-dipper/`. Real RTX 5080. Max with his own
hands clicking / pressing keys / observing layout / ergonomics. Watching
working-Claude or Tester drive chrome-devtools is NOT UAT — that's
integration with Max as reviewer.

**Felt-experience handoff:** Tester PASSes integration structurally.
Max GATE 3 confirms in real environment. Verdict
`PASS — UAT deferred to Max` is the explicit handoff.

**When N/A:**
- Pure-refactor workstreams (telemetry-equivalence via
  `refactor-verification.md`; no Max-eyes beyond reading the diff)
- Doc-only workstreams
- Internal kit-side improvements when nothing user-facing changes

**PM ask per workstream:** *"Does this touch user-facing surface —
visual rendering, input responses, audio, motion, layout? If yes,
UAT relevant. If no, UAT N/A."*

### Tester verdict shape

```
**Unit:** PASS | FAIL | N/A (rationale)
**Integration:** PASS | FAIL | N/A (rationale)
**UAT:** PASS | deferred to Max | N/A (rationale)
```

Typical well-dipper visible-behavior outcome:
`Unit: PASS / Integration: PASS / UAT: deferred to Max`.

## Visual lab harness pattern (for shader/rendering features)

When building a new visual feature (shader, rendering effect, procedural
generation change):

1. **Create a standalone HTML harness** at project root named after the
   feature: `<feature>-lab.html`.
2. **Import only the module(s) under test**, not the whole game.
   Minimal Three.js scene: renderer, camera, mesh.
3. **If touching a production renderer, copy first.** Create
   `Experimental*` / `WarpTunnel*` / similar variant; modify the copy.
   Production class stays untouched until look is locked.
4. **Expose tunable uniforms via sliders** + buttons for canonical test
   states.
5. **Expose `window._lab` / `window._viewer`** for programmatic driving
   (playwright/chrome-devtools automation, console debugging).
6. **Iterate in the harness until look is right.** Don't also edit
   production code — that's what makes this pattern fast.
7. **Port approved changes into the real file** in one focused pass
   once visuals are locked. Delete the experimental copy.

**Running a harness:**
```
cd ~/projects/well-dipper && npx vite
# Browse to http://localhost:5173/well-dipper/<harness>.html
```
(Base path `/well-dipper/` per `vite.config.js` GitHub Pages config.)

**Existing harnesses** (kept as references — don't delete on feature ship):

| File | Tests | Notable |
|---|---|---|
| `galaxy-glow-viewer.html` | `ProceduralGlowLayer.js` | 7 teleport presets, molecular-cloud sliders, clouds ON/OFF toggle |
| `tunnel-lab.html` | `WarpTunnelStarfieldLayer.js` (experimental) | Warp sliders, "Play Full Warp" FOLD/ENTER/HYPER/EXIT button |

**Cross-project rule:** `feedback_isolated-test-harnesses.md` — Well
Dipper visual features build the harness BEFORE touching production
code. If the mechanism doesn't work in isolation, the production
integration can't save it.

## Screenshot storage

All playwright / automated visual test screenshots → `screenshots/`
at project root. Prefix filenames with `screenshots/` so output lands
there, not in parent working directory.

## Carve-outs

**Felt-experience-only criteria** ("warp tunnel feels cinematic"):
Tester verdict says `UAT: deferred to Max`. No structural verification
replaces Max's eyes.

**Performance budgets** are integration concerns. `rendererInfo.drawCalls`
and `rendererInfo.triangles` captured in inventory. Goldens commit
baseline; integration asserts ±10% via kit's `drawCallBudget` +
`triangleBudget` predicates.

**Audio inventory category is opt-in.** Host's audio engine doesn't
expose AudioContext on `window`. Workstreams needing richer audio
observability call `__wd.setAudioProvider(() => [...])` at workstream
start.

**`clocks.warp` reports 0 in idle.** WarpEffect doesn't reset internal
`.elapsed` on idle transition. Inspector gates `clocks.warp` by
`phases.warp === 'idle'` to keep `clockProgressedSince` predicates
honest. Documented at `SceneInspector.js` `deriveClocks`.

## Cross-references

- `docs/PERSONAS/pm.md` — brief template "Test Coverage Plan" section
- `docs/PERSONAS/tester.md` — verdict shape "Evidence reviewed (per layer)"
- `docs/PROTOCOLS/refactor-verification.md` — telemetry-equivalence
  protocol for pure-refactor workstreams
- `~/projects/motion-test-kit/runbooks/06-scene-inventory.md` — kit-side
  technique reference
- Claude memory: `feedback_three-layer-test-coverage.md`,
  `feedback_pass-fail-vs-diagnostic.md`,
  `feedback_input-record-replay-integration.md`,
  `feedback_test-actual-user-flow.md`,
  `feedback_drive-ac-checks-via-chrome-devtools.md`
- **For scene-inspection-specific walkthrough + integration-test catalog
  (~900 lines of pre-v5 content):** consult
  `ARCHIVE/testing-scene-inspection-demo-walkthrough_LEGACY.md` +
  `ARCHIVE/testing-scene-inspection-integration-tests_LEGACY.md`. Will
  inform `SYSTEMS/inspection-layer/README.md` when that system gets
  authored (tracked in JOURNEY structural debt).
