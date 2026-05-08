# Workstream: inspection-layer-v2 Phase B — frame timing primitives (2026-05-08)

Second phase of `docs/PLAN_inspection-layer-v2.md`. Independent of Phase A; can execute in parallel. Adds frame-timing observability (LoAF + WebGL GPU timer queries) to the scene-inventory API.

## Why we care

The mid-warp freeze observed during prior session (multi-second stall mid-HYPER) was invisible to the inspection layer. Naming + screen-space + cross-event-state are all spatial dimensions; freezes are a TIME dimension. Without frame-timing primitives, integration tests cannot catch the class "feature ran but blocked the main thread for >1s." The user feels it; we don't see it.

Phase B closes the time dimension. After Phase B, defects like "warp HYPER stalled for 2.3s" become a one-line predicate FAIL (`noLongAnimationFramesDuringHyper(thresholdMs: 250)`) instead of relying on Max's eyes-and-stopwatch.

Composes with: Phase E re-authors warp-suite assertions using both Phase A's screen-space and Phase B's frame-timing primitives. Phase C's event-boundary diff also benefits from being timestamped against frame deltas.

## Current objective + success criteria

**Objective:** The scene inventory captures both browser-side long-animation-frame events and (where available) GPU-side per-pass timing during a window of activity. Predicates make these queryable for assertions like "no frame longer than X ms during phase Y."

**Success criteria (in Max's language):**

1. **`inv.timing.longFrames[]` populated when LoAF fires.** PerformanceObserver subscribes to `long-animation-frame` entries (browser-native API; Chrome 123+, Edge 123+, no-op in Safari/Firefox without flags). Each entry: `{ frameId, startTime, duration, blockingDuration, scripts: [{ name, duration }] }`. Buffer is bounded — keep last N=64 entries (configurable).
2. **`inv.timing.gpuPasses[]` populated from EXT_disjoint_timer_query_webgl2 when supported.** Each entry: `{ pass: 'main' | 'sky' | 'composer' | 'overlay', duration_ns }`. If the extension is unavailable (browser/driver lottery), `inv.timing.gpuPasses === null` and `inv.timing.gpuTimingSupported === false` — distinguish unsupported-vs-empty.
3. **`inv.timing.windowStart` and `inv.timing.windowEnd` named.** A "timing window" is the period from the last `__wd.beginTimingWindow(name)` to now, OR all entries in the LoAF buffer if no window opened. Lets assertions scope to a specific phase: open window at warp start, close at warp end, assert no LoAF >250ms inside.
4. **Predicate `noLongAnimationFrames(options)`** returns PASS when `inv.timing.longFrames` filtered to the window has no entry exceeding `options.thresholdMs` (default 250). FAIL output names the offending frames with timestamps for debugging.
5. **Predicate `frameTimeBound(options)`** returns PASS when ALL frames in the window stay under `options.budgetMs` (default 16.67 — 60fps). Different from `noLongAnimationFrames` because LoAF only fires on >50ms blocking; this predicate uses a finer-grained source if available, or degrades to LoAF data with a documented coarseness caveat.
6. **Predicate `gpuPassTimeBound(options)`** returns PASS when each pass in `inv.timing.gpuPasses` stays under `options.budgetMs` for the named pass. If `gpuTimingSupported === false`, predicate returns `{ pass: 'N/A', reason: 'EXT_disjoke_timer_query_webgl2 unavailable' }` — UAT-equivalent for "we tried." Tester verdict accepts N/A as PASS for the predicate's own coverage but flags the gap in evidence.
7. **`__wd.beginTimingWindow(name)` and `__wd.endTimingWindow()` ergonomic surface.** Opens/closes a named window. Exposes `inv.timing.window === { name, start, end }` for assertions to filter against.
8. **Phase B integration test (`__wd.runPhaseBTests` or extension to `runIntegrationSuite`).** Drives a deliberately-slow synthetic scenario — e.g., a `__wd.simulateBlockingWork(2000)` helper that runs `while(performance.now() < deadline){}` for 2s — asserts LoAF fires with appropriate duration. Removes the helper, asserts subsequent frames are quiet. **Expected behavior:** initial assertion FAILs if LoAF firing is broken on the platform; PASSes when working.
9. **No regressions to existing well-dipper or kit unit/integration suites.** Phase B is additive; the new fields are gated behind feature-detection so non-supporting browsers see structured `null`s rather than throwing.
10. **Mid-warp-freeze regression DETECTED programmatically when present.** If Max can reproduce the multi-second freeze: open timing window before warp, close after, run `noLongAnimationFrames(thresholdMs: 250)` — assertion FAILs in the bug-present state, PASSes after the bug is fixed. Phase F's triage-workstream uses this to verify the fix. **Phase B itself doesn't fix the freeze; it makes the freeze catchable.**

## Architectural connections

### Inputs (what this consumes)

- **`PerformanceObserver` browser API** — well-dipper targets modern Chrome (Max's RTX 5080); LoAF available since Chrome 123. Firefox + Safari behavior: feature-detect, degrade gracefully (emit `inv.timing.longFramesSupported === false`).
- **`EXT_disjoint_timer_query_webgl2`** — WebGL2 extension exposing GPU-side timing. Driver lottery: ANGLE on Windows often has it; Linux+Mesa often doesn't; mobile rarely. Feature-detect via `gl.getExtension('EXT_disjoint_timer_query_webgl2')`.
- **`motion-test-kit/scene-inventory-adapter.js`** — adapter where new `timing` sub-tree lives. Vendored at `vendor/motion-test-kit/`.
- **`motion-test-kit/predicates/`** — new predicates land here.
- **Existing inventory shape** — extended with `inv.timing` sub-tree; `null` when unsupported.
- **Phase A's primitives** — NOT a hard dependency. Phase B reads/writes `inv.timing` independent of Phase A's `screenSpace`/`projectedSize` extension. Confirms via parallel-execution: A and B can compose at vendor-sync time.

### Outputs (what depends on this)

- **Phase E** (warp-suite re-author) — uses `noLongAnimationFramesDuringHyper(thresholdMs: 250)` as a core assertion.
- **Phase F** (triage workstream) — uses Phase B's primitives to verify the mid-warp-freeze fix.
- **All future visible-feature workstreams** — frame-timing assertions become the default for "did this feature stay smooth."
- **`well-dipper-progress.md` testing roadmap** — Phase B status entry.

### Features that must stay working

- All existing `__wd.takeSceneInventory` callers — the new `inv.timing` field is additive.
- `__wd.runIntegrationSuite()` + `__wd.runWarpSuite()` — both PASS unchanged.
- Production-bundle drift guard — Phase B code is dev-only; PerformanceObserver is dev-only; GPU timer query setup is dev-only.
- Performance: PerformanceObserver overhead is documented as low (~µs per entry); GPU timer queries cost an extra `gl.beginQuery`/`endQuery` per pass per frame. Self-check renders stay near 60fps with the layer active.

## Test Coverage Plan

| AC | Unit coverage | Integration coverage | UAT coverage |
|---|---|---|---|
| 1 LoAF buffer | Kit-side `tests/scene-inventory-timing.test.js` — synthetic PerformanceObserver entries pushed through the buffer; assert FIFO bounded behavior (N=64), schema correctness. | `__wd.runPhaseBTests` — `simulateBlockingWork(500)` triggers LoAF → assertion that `inv.timing.longFrames[].duration > 400`. | Bundled into AC10. |
| 2 GPU passes | Kit-side unit test — synthetic `EXT_disjoint_timer_query_webgl2`-shaped data through the formatter; both `gpuTimingSupported: true/false` paths. | `__wd.runPhaseBTests` — feature-detect on real GL context, assert `inv.timing.gpuPasses` is either populated array OR `null + supported: false`. | Bundled into AC10. |
| 3 Window scoping | Kit-side unit test — open/close/re-open window logic. | `__wd.runPhaseBTests` — open window, simulate work, close window, assert filtered LoAF entries match window range. | Bundled into AC10. |
| 4 `noLongAnimationFrames` | Kit-side unit test — PASS / FAIL / window-empty / threshold-edge cases. | `__wd.runPhaseBTests` — synthetic blocking work assertion. | Bundled into AC10. |
| 5 `frameTimeBound` | Kit-side unit test — same shape. | `__wd.runPhaseBTests`. | Bundled into AC10. |
| 6 `gpuPassTimeBound` | Kit-side unit test — supported + unsupported paths return correct verdict shape. | `__wd.runPhaseBTests` — degrades cleanly on platforms without the extension. | Bundled into AC10. |
| 7 Window ergonomic surface | Kit-side unit test — `__wd.beginTimingWindow` / `endTimingWindow` semantics. | `__wd.runPhaseBTests`. | UAT bundled — Max's hands open/close windows in console. |
| 8 Phase B integration test | N/A | Self — the runner exercises everything. | Bundled into AC10. |
| 9 No regressions | `npm test` (well-dipper + kit) — baseline preserved. | `runIntegrationSuite` + `runWarpSuite` — PASS. | UAT N/A. |
| 10 Mid-warp-freeze detection | N/A | `__wd.runPhaseBTests` includes a "warp-freeze probe" that wraps `_beginWarpTurn()` in a timing window and asserts no LoAF >250ms. **Expected to FAIL** in current-bug state. Phase B SHIPS WITH THIS FAILURE because the layer correctly identifies the bug — fix routes to Phase F. | Max in real Chrome at `localhost:5174/well-dipper/?lab=1` runs `await __wd.runPhaseBTests()` and reads the report. Per `feedback_drive-vs-watch-distinction.md` — real UAT: Max's hands, Max's environment. Evaluates ergonomics: are the timing assertions easy to write? Is the window API legible? |

### Coverage notes

- **Browser-feature lottery:** Phase B's coverage is honest about non-Chromium degradation. On Firefox/Safari without LoAF, integration tests assert `inv.timing.longFramesSupported === false` and skip dependent assertions. Tester verdict reports N/A with reason rather than FAIL.
- **GPU timer query is INFORMATIONAL when unsupported.** Don't gate Shipped on it. Phase B is GREEN with `gpuTimingSupported: false` if running on a platform without the extension.
- **Mid-warp-freeze test FAILing is correct per `feedback_pass-fail-vs-diagnostic.md`.** The integration test correctly identifies the bug. Don't re-author until Phase F lands a fix.

## In scope

- Extending `motion-test-kit/scene-inventory-adapter.js` with `inv.timing` sub-tree (LoAF + GPU passes + window).
- 3 new predicates (`noLongAnimationFrames`, `frameTimeBound`, `gpuPassTimeBound`).
- 2 new ergonomic-surface methods (`beginTimingWindow`, `endTimingWindow`).
- Kit-side unit tests covering all paths.
- Well-dipper-side integration runner (`__wd.runPhaseBTests` OR extension to `runIntegrationSuite`).
- Vendoring updated kit into well-dipper.
- Updating `docs/testing/scene-inspection-integration-tests.md` with Phase B group.
- Updating `well-dipper-progress.md` testing roadmap.
- Tester verdict at to-be-shipped commit.

## Out of scope

- **Fixing the mid-warp freeze.** Phase F triage workstream concern.
- **Pre-emptive optimization to avoid LoAF firing.** Phase B catches; doesn't fix.
- **Phase A's screen-space primitives.** Independent workstream; may compose at vendor-sync time but Phase B doesn't author A's code.
- **Pixel-buffer timing (per-frame capture).** Phase D concern.
- **CI integration of frame-timing assertions.** Future work; record-replay integration (Phase 0 of testing-framework upgrade) is the path. Phase B's runner is in-session-only initially.
- **Cross-browser parity beyond feature-detect-and-degrade.** Don't author Firefox/Safari workarounds; Chrome is well-dipper's primary surface.

## Drift risks

- **Phase A's vendor-sync conflict.** If Phase A vendors first, Phase B's edits to `scene-inventory-adapter.js` need to layer over A's. If A and B vendor close in time, expect a merge in `vendor/motion-test-kit/`. Resolution: working-Claude on Phase B coordinates with Phase A's vendor commit timing.
- **PerformanceObserver shape changes between Chrome versions.** Currently stable; if Max upgrades Chrome significantly, Phase B's schema may drift. Mitigation: feature-detect, schema-validate at adapter boundary.
- **GPU timer query "disjoint" flag.** Per WebGL spec, `gl.GPU_DISJOINT_EXT === true` invalidates ALL outstanding queries. Adapter must check + discard. Skipping this leads to wildly inaccurate values that look like legitimate slowdowns.
- **Window mismatch.** Calling `endTimingWindow` without `beginTimingWindow` should be a no-op + warning, not throw. Same for re-`begin` without close (replace prior, warn).
- **Performance regression in inspection layer.** Per-frame GPU timer query overhead is non-trivial on some drivers. Self-check that frame rate stays near 60fps with timing active; gate behind `__wd.beginTimingWindow` so it's only paid when a test is running.

## Handoff

**Active workstream pointer (when Phase B begins execution):** `~/.claude/state/dev-collab/set-active.sh well-dipper inspection-layer-v2-phase-b-frame-timing-primitives-2026-05-08`.

**Phase B runs AFTER Phase A's brief is greenlit, in parallel with Phase A's execution OR sequentially after A — Max decides at execution time.** This brief is authored now so PM-mode work is consolidated; running Phase B execution in parallel with Phase A's execution requires two working-Claude sessions or careful phase-interleaving by one. Conservative default: serialize, take A through Tester PASS first.

**Three-Max-gate loop:** Same shape as Phase A. Gate 3 UAT: Max in his real Chrome at `localhost:5174/well-dipper/?lab=1` runs `await __wd.runPhaseBTests()`.

**Push-on-shipped:** established-deploy.

**Queued downstream:** Phase C (cross-event state diff) depends on Phase A's inventory shape stable; can be PM-scoped after Phase A's Tester PASS. Phase D (pixel-buffer + filmstrip) depends on Phase A + Phase C. Phase E (warp-suite re-author) depends on A + B + C + D. Phase F (triage) depends on E. Phase G (other features) depends on F.
