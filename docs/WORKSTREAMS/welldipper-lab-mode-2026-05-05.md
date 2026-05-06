# Workstream: well-dipper lab-mode keybinds (2026-05-05)

## Status

**Scoped 2026-05-06 against well-dipper HEAD `3345e40`** (post fixed-timestep migration Shipped `89a6c116` + Phase 5 amendment + Shipped flip). Authored as **parallel sibling** to `motion-test-kit-scene-inventory-2026-05-05` (kit-side technique #6). Both are queued for the same execution window. This brief does NOT block on the kit's scene-inventory shipping — Phase 1 below carves a telemetry-only fallback for scenario-entry verification. Full payoff lands when both ship; partial payoff (interactive felt-experience surface) lands as soon as this workstream ships.

This is the workstream the fixed-timestep migration's AC #17 Layer B placeholder pointed at. The Shift+L stub panel currently in `src/main.js` (lines ~7399-7412) is replaced by the full keybind layer + HUD overlay this brief delivers.

## Parent feature

**N/A — dev tooling workstream.** Per `docs/PERSONAS/pm.md` §"Carve-out: process / tooling workstreams," this is dev tooling, not a game feature. Lab-mode is the felt-experience surface that replaces canvas recordings as the default for game-feel gates per the new rule (`~/.claude/projects/-home-ax/memory/feedback_lab-modes-not-recordings.md`, 2026-05-05). It does not advance any single feature in `docs/FEATURES/`; it is the verification substrate that *all* motion-class features will be evaluated against going forward.

The features this lab serves (across the keybinds):

- `docs/FEATURES/warp.md` — keybinds 1, 2, 4, 7 cover warp scenarios at near-origin / far-origin / mid-tunnel / arrival-overlay surfaces.
- `docs/FEATURES/autopilot.md` — keybinds 3, 5, 6 cover mid-CRUISE / manual-toggle / STATION-hold scenarios across the V1 motion path.
- General reticle / HUD overlays — keybind 7 is explicitly designed to reproduce the post-warp reticle/runway-persist regression Max reported 2026-05-05.

ACs are **contract-shaped** (per the dev-tooling carve-out), not phase-sourced. Each scenario is a contract: pressing key K with `?lab=1` in the URL produces a deterministic, reproducible scene state suitable for Max's interactive evaluation.

## Implementation plan

N/A as a separate `docs/PLAN_*.md` doc. The phasing in §"Acceptance criteria" carries the architecture inline. Two reference inputs working-Claude reads first:

- The Shift+L stub already in `src/main.js` lines ~7399-7412 — exact pattern for `?lab=1` URL gating + HUD-panel injection. Phase 1 of this brief replaces it.
- `~/projects/motion-test-kit/docs/WORKSTREAMS/motion-test-kit-scene-inventory-2026-05-05.md` — the parallel sibling. If it ships first, lab-mode scenario-entry assertions read scene-inventory snapshots; if it ships second, lab-mode falls back to telemetry-only (see Phase 1 fallback below). Lab-mode does NOT consume any kit API that doesn't yet exist; the fallback is structural.

## Source material

**Read in order before authoring code:**

1. `~/.claude/projects/-home-ax/memory/feedback_lab-modes-not-recordings.md` — the rule this workstream is built to support. Especially §"How to apply" (working-Claude obligations) and §"Why" (recordings' time-cost + lossy-framing problems lab-mode solves).
2. `docs/WORKSTREAMS/welldipper-fixed-timestep-migration-2026-05-03.md` §"Sibling workstreams (next)" — the one-paragraph scoping note that named this brief, plus AC #17 Layer B in §"Acceptance criteria / Phase 5" describing the stub being replaced.
3. `docs/PERSONAS/tester.md` §"Production-grade verification (post-migration)" — the bug-class table's top row ("Felt-experience-class → Lab-mode keybind") plus the "Default-load rule" subsection name lab-mode as the structural replacement for recordings. The "Structural-visibility-class" row names scene-inventory as a forward dependency on the parallel sibling — that dependency surfaces in Phase 1's fallback below.
4. `~/.claude/projects/-home-ax/memory/feedback_build-dev-shortcuts.md` — Max's authorization for dev-mode shortcuts (URL params, debug funcs) that skip splash/title/intro when iterating on deep-game features. Treat as temp scaffolding, remove with the workstream. Lab-mode IS this pattern at scale.
5. `~/.claude/projects/-home-ax/memory/session-2026-05-05-phase5-shipped-and-rule-shift.md` §"Two visible regressions Max reported during this session (NOT investigated yet)" — the reticle/runway-persist + warp-tunnel-second-half-missing regressions. Keybind 7 is explicitly scoped to reproduce regression #1.
6. `src/main.js` lines 7387-7826 — the existing keydown handler. Lab keybinds wire in here; Phase 1 needs to confirm the **placement order** so existing 1-9 handlers (which fire on plain digit keys for `jumpToStar` / `jumpToPlanet` / `focusPlanet`) don't conflict with lab keybinds. See "Drift risks" / "Conflicting keybinds" below for the chosen path.
7. `src/effects/WarpEffect.js` lines 25-95 — the actual phase enum (`'idle' | 'fold' | 'enter' | 'hyper' | 'exit'`) and the `start()` method's signature. Note: enum has six phases (idle counted at start + end), not the five named in the migration brief's aspirational AC #17 Layer A — see migration brief's amendment-history entry for reconciliation. Lab scenario 4 (mid-HYPER) needs to drive WarpEffect through `idle → fold → enter → hyper` and pause / fast-forward at hyper-onset.
8. `window._autoNav` / `window._navSubsystem` / `window._autopilot` / `window._warpEffect` exposed in `src/main.js` lines ~525-1596 — these are the existing debug surfaces lab-mode uses to drive scenario setup. No new debug surfaces are introduced by this workstream; lab-mode composes existing APIs.

## Scope statement

Implement a lab-mode keybind layer at `src/debug/LabMode.js` (new module) that ships seven keybinds gated behind URL param `?lab=1`. Each keybind teleports Max to a specific deterministic test scenario for interactive felt-experience evaluation. The keybinds are wired into the existing keydown handler in `src/main.js` (~line 7387) AFTER the URL-param gate, BEFORE the existing 1-9 digit-key handlers — using a modifier (Shift) on the digit keys to avoid conflict with autopilot's `jumpToStar` / `jumpToPlanet` and idle-mode's `focusPlanet`. A small floating HUD overlay lists the seven keybinds when `?lab=1` is active so Max doesn't have to remember which key is which. The Shift+L stub panel currently in `main.js` is replaced by the full lab-mode HUD overlay; Shift+L itself becomes "toggle the overlay's visibility" rather than its current "open the stub-text panel."

Each scenario function is `~30-50 LOC` in `LabMode.js`, exporting `setupScenario1Sol()` / `setupScenario2Far()` / etc. The functions compose the existing `_autoNav` / `_warpEffect` / `_autopilot` debug APIs to set up state deterministically (seeded RNG via `?seed=N` URL param if applicable; no fresh `Math.random()` calls in scenario setup). At scenario entry, lab-mode either captures a scene-inventory snapshot (if the kit's scene-inventory technique is available — sibling workstream `motion-test-kit-scene-inventory-2026-05-05`) OR a telemetry-only structural snapshot (Phase 1 fallback) and writes it to `window._labMode.lastEntrySnapshot` for verification.

The seven scenarios:

- **1**: Warp-from-Sol — Sol loaded, Earth selected as warp target, ready to commit warp on Space.
- **2**: Warp-from-far — ship pre-positioned at world-coords ≥10,000 scene units from origin (a position that crosses `REBASE_THRESHOLD_SQ` during HYPER), warp target locked to a Sol-system body. Mirrors the world-origin rebasing workstream's two-position test pattern as an interactive scenario.
- **3**: Mid-CRUISE on autopilot leg — autopilot active, ship in the middle of a CRUISE phase between two tour stops, target body visible mid-leg. Scenario picks Sol → Earth (or Sol's first few-planet sequence) and time-advances the leg to the CRUISE midpoint deterministically before handing off.
- **4**: Mid-HYPER warp tunnel — warp active in HYPER phase mid-traversal. Time-advances `WarpEffect` through `idle → fold → enter → hyper` and pauses (or slows) at hyper-onset so Max lands inside the tunnel. Per the migration brief's reconciliation, the actual phase enum has `fold` between `idle` and `enter`; the scenario advances through all six phases up to hyper. (Replaces the Shift+L stub.)
- **5**: Manual-flight mode — autopilot disabled (Q-toggled off), ship hovering near a body, WASD-active. Reproduces the manual-flying-toggle workstream's target state without needing the user to navigate the toggle UI manually.
- **6**: STATION-A hold — autopilot parked at a body, hover/orbit framing active. Reproduces the V1 STATION-hold redesign's terminal state.
- **7**: Reticle/runway-persist scenario reproducer — explicitly designed to reproduce the regression Max reported 2026-05-05 ("crosses runway persists after warp and follows you around"). Sets up state that triggers the bug reliably: warp from Sol to a body, lets warp complete to `idle`, then leaves the camera/ship in the post-warp arrival state with the reticle/runway-targeting overlay visible. Max iterates on the fix interactively from this entry point.

This is a single workstream because the seven scenarios share a common HUD overlay, gate, keybind layer, snapshot infrastructure, and module — splitting into one workstream per scenario would multiply boilerplate across seven briefs while sharing the same drift risks. The seven scenarios are scoped together so the tooling pays back as one investment, not seven.

## How it fits the bigger picture

This workstream is the well-dipper-side implementation of the new verification methodology articulated 2026-05-05:

> *"once you verify that something works in terms of the telemetry/asset data, I want you to give me test modes/areas where needed rather than recordings"*

It advances:

- **Game Bible §11 Development Philosophy / Principle 6 (First Principles Over Patches).** The fixed-timestep migration was Principle 6 applied to the sim substrate. The lab-mode-not-recordings shift is Principle 6 applied to the verification substrate: instead of patching the recording-evaluation cycle's time-cost and lossy-framing problems with better recording tools (longer canvas captures, cleaner contact sheets, frame-extraction helpers), the redesign relocates the felt-experience surface to a lab Max can drive interactively. This brief is the well-dipper-side execution of that redesign.

- **Game Bible §11 / Principle 2 (No Tack-On Systems).** The temptation here is to bolt scenario setup into existing dev shortcuts ad-hoc — a `?warp-sol=1` URL param here, a `?manual-flight=1` URL param there. Each one would compose with the others poorly and accumulate in `main.js` like sediment. The dedicated `src/debug/LabMode.js` module + unified keybind layer + HUD overlay is the structural-not-tack-on shape. The Shift+L stub is the load-bearing precedent; Phase 1 of this brief deliberately retires it rather than letting it become permanent dev cruft.

- **Tester verification ladder + the migration's AC #17 Layer B carve.** AC #17 Layer A telemetry harnesses and Layer B stub keybind already PASS structural-correctness gates for the warp + autopilot motion paths. What they don't cover is felt-experience: does motion FEEL right at all the canonical scenarios? Recordings were the prior answer; lab-mode is the new answer. Without this brief shipping, Tester is stuck at "telemetry PASS, felt-experience deferred to live screensaver loop" — which works for the screensaver-shaped scenarios but not for warp-from-far / mid-HYPER / reticle-persist where the screensaver doesn't naturally land Max in the right state.

- **Triage path for the two parked regressions.** The 2026-05-05 reticle/runway-persist + warp-tunnel-second-half-missing regressions were parked specifically because they need this tooling to investigate. Keybind 7 reproduces regression #1 reliably; keybind 4 (mid-HYPER) reproduces regression #2's evaluation context. Without this brief shipping, the regressions stay parked and Max's user-facing experience continues to carry the bugs.

The story for cross-project portability: lab-mode keybinds are well-dipper-specific (the scenarios are well-dipper scenarios), but the *pattern* — URL-gated dev keybinds + scenario module + HUD overlay + scene-inventory or telemetry snapshot at entry — is a template other game-shaped projects (paper-theater, lowpoly-studio if it grows interactivity) could mirror. This brief does not author the cross-project template; it executes the well-dipper instance.

## Acceptance criteria

The verification ladder for this workstream is **contract-shaped** per the dev-tooling carve-out. Each AC names a scenario contract + a verifiable observation. ACs #1-#3 are infrastructure (gate, HUD, snapshot); ACs #4-#10 cover the seven scenarios; AC #11 is the stub retirement; AC #12 is Tester invocation surface.

### Phase 1 — Infrastructure (gate, HUD, snapshot)

1. **`?lab=1` URL param gate active; new `src/debug/LabMode.js` module exists and is imported from `main.js`.** The module exports a `LabMode` class or named-export bag with: `init(opts)` (called once at boot if `?lab=1` is in URL), `setupScenarioN()` for N=1..7, `captureEntrySnapshot()` (called by every scenario function before handoff), `toggleHud()` (called by Shift+L). The module is gated so importing it does NOT execute scenario setup unless `?lab=1` is present. Verifiable: `grep "import.*LabMode" src/main.js` matches; with `?lab=1` in URL, `window._labMode` is non-null; without `?lab=1`, `window._labMode` is undefined OR is a no-op stub.

2. **HUD overlay exists; lists all 7 keybinds + scenario descriptions.** When `?lab=1` is present, a small floating panel in a corner of the viewport (top-left or top-right) lists:
   - `Shift+1 — Warp from Sol`
   - `Shift+2 — Warp from far (≥10k units)`
   - `Shift+3 — Mid-CRUISE on autopilot leg`
   - `Shift+4 — Mid-HYPER warp tunnel`
   - `Shift+5 — Manual-flight mode (autopilot off)`
   - `Shift+6 — STATION-A hold`
   - `Shift+7 — Reticle/runway-persist reproducer`
   - `Shift+L — Toggle this overlay`
   The overlay's exact wording is at working-Claude's discretion; the seven scenarios + the toggle key must all be listed. Verifiable: with `?lab=1`, `document.getElementById('lab-hud')` (or equivalent named element) returns a non-null DOM node containing each scenario's keybind+name; without `?lab=1`, no such element exists.

3. **Scenario-entry snapshot captured at every scenario function's exit.** Each `setupScenarioN()` calls `captureEntrySnapshot()` before returning control to the user. The snapshot is written to `window._labMode.lastEntrySnapshot` and contains:
   - **Forward-dependency-aware path:** if the motion-test-kit's scene-inventory technique #6 is available (detected by `typeof window._motionKit?.sceneInventory === 'function'` or equivalent kit-export), call it and store the inventory snapshot.
   - **Telemetry-only fallback path** (used if scene-inventory technique is not yet shipped): capture a structural snapshot from existing surfaces — `_autopilot.telemetry.samples.at(-1)` for autopilot state, `_warpEffect.state` + `_warpEffect.foldAmount` + `_warpEffect.hyperPhase` + `_warpEffect.exitReveal` for warp state, `getComputedStyle()` queries on the four most-load-bearing DOM overlays (reticle/HUD/keybinds-panel/lab-hud) for visibility, and `_navSubsystem` body-lock state.
   The snapshot dispatches a custom event `'labmode:scenarioReady'` on `window` so external test harnesses can consume it. Verifiable: after pressing any of Shift+1..Shift+7, `window._labMode.lastEntrySnapshot` is populated with a non-empty object containing scenario name, timestamp, and the structural state above.

### Phase 2 — Seven scenario keybinds

4. **Shift+1 — Warp-from-Sol.** Pressing Shift+1 with `?lab=1` in URL sets up: Sol loaded (via `_autoNav` or direct system loader), Earth selected as warp target, ship at near-origin, warp NOT yet started — Space-press initiates the warp. Snapshot at scenario entry shows `_warpEffect.state === 'idle'`, `_navSubsystem.bodyRef` references Earth, ship world-position within (e.g.) 1000 scene units of origin. Same key-press always produces same starting state (deterministic; if any scenario state requires randomness, scenario uses seeded RNG via `?seed=N` URL param). Verifiable: press Shift+1 twice in two separate page loads with same URL; `_labMode.lastEntrySnapshot` matches at scenario name + structural keys.

5. **Shift+2 — Warp-from-far.** Pressing Shift+2 with `?lab=1` in URL sets up: ship pre-positioned at world-coords ≥10,000 scene units from origin (a position that crosses `REBASE_THRESHOLD_SQ` during HYPER), warp target locked to a Sol-system body, warp NOT yet started. Mirrors the world-origin rebasing workstream's two-position test pattern. Snapshot shows ship world-position magnitude ≥10,000, warp state `idle`, target body locked. Verifiable: same as AC #4 plus an explicit assertion that `Math.hypot(snapshot.shipWorld.x, snapshot.shipWorld.y, snapshot.shipWorld.z) >= 10000`.

6. **Shift+3 — Mid-CRUISE on autopilot leg.** Pressing Shift+3 with `?lab=1` in URL sets up: autopilot active, leg in progress between two known tour stops (e.g., Sol → Earth or Sol → first planet), ship at a deterministic position along the CRUISE phase (e.g., 50% of leg distance, or midpoint of the CRUISE phase per autopilot's published `shipPhase` field). Per the migration brief's reconciliation: autopilot V1 exposes only CRUISE + STATION at the published `shipPhase` field; the scenario asserts CRUISE at entry. Time-advances the leg to the midpoint by either: (a) explicitly setting AutopilotMotion's internal leg-progress field, or (b) running the sim forward via `simRandom`-seeded fixed-step ticks until midpoint is reached. Working-Claude picks (a) if the API surface allows direct progress injection; otherwise (b). Snapshot shows `_autopilot.shipPhase === 'CRUISE'`, leg progress between 0.4 and 0.6, target body identified. Verifiable: same as AC #4; reproducibility verified across two page loads.

7. **Shift+4 — Mid-HYPER warp tunnel.** Pressing Shift+4 with `?lab=1` in URL sets up: warp active in HYPER phase mid-traversal. Sets warp target to a body, calls `_warpEffect.start(...)`, then time-advances `WarpEffect` deterministically through `idle → fold → enter → hyper` (advances the actual six-phase enum, not the migration brief's aspirational five-phase enum) and pauses at hyper onset (or at hyper midpoint, working-Claude's call — pick whichever scenario gives Max the cleanest mid-tunnel evaluation surface). Snapshot shows `_warpEffect.state === 'hyper'`, hyperPhase ∈ [0, 1] (within hyper), tunnel mesh visible, exit-reveal not yet active. Verifiable: same as AC #4 plus `snapshot.warpState === 'hyper'`. (This scenario explicitly replaces the Shift+L stub's text-only placeholder; pressing Shift+4 lands Max IN the tunnel rather than reading text about it.)

8. **Shift+5 — Manual-flight mode (autopilot off).** Pressing Shift+5 with `?lab=1` in URL sets up: autopilot disabled (call `_autoNav.stop()` or whichever toggle path the manual-flying workstream uses), ship hovering near a body or in open space (working-Claude's call — somewhere Max can WASD around), input-bridge active. Snapshot shows autopilot inactive (`_autopilot.shipPhase === undefined` or `_autoNav.isActive === false` or whichever published field signals "off"), ship world-position deterministic, no active warp. Verifiable: same as AC #4 plus `snapshot.autopilotActive === false`.

9. **Shift+6 — STATION-A hold.** Pressing Shift+6 with `?lab=1` in URL sets up: autopilot parked at a body in STATION phase, hover/orbit framing active. Either: (a) start an autopilot tour and time-advance to the first STATION transition, or (b) directly inject AutopilotMotion into STATION state at a known body. Working-Claude picks the cleaner path. Snapshot shows `_autopilot.shipPhase === 'STATION'`, body locked, ship in orbit/hover framing. Verifiable: same as AC #4 plus `snapshot.shipPhase === 'STATION'`.

10. **Shift+7 — Reticle/runway-persist reproducer.** Pressing Shift+7 with `?lab=1` in URL sets up: state that reliably reproduces the regression Max reported 2026-05-05 ("crosses runway persists after warp and follows you around"). Concrete sequence: warp from a near-origin position to a body, time-advance warp through `idle → fold → enter → hyper → exit → idle` to completion, leave camera/ship in post-warp arrival state with reticle/runway-targeting overlay visible. Snapshot at scenario entry should capture which DOM overlays / 3D meshes are visible (reticle, runway-overlay if separate, warp-arrival-crown if separate) — this is the diagnostic signal for the bug investigation. **AC for this scenario is structurally weaker than the others by design:** the regression is the load-bearing thing to reproduce, not a guarantee of post-warp state correctness. The scenario contract is: pressing Shift+7 lands Max in a state where the bug reproduces visibly. Once the bug is fixed (in a future workstream), this scenario remains useful as a regression sentinel. Verifiable: pressing Shift+7 produces a `_labMode.lastEntrySnapshot` whose structural snapshot includes reticle / runway / arrival-overlay visibility states for Max to diagnose. Does NOT assert any particular visibility value — that's the bug under investigation.

### Phase 3 — Stub retirement + Tester surface

11. **Shift+L stub panel retired; Shift+L now toggles the lab HUD overlay.** The block in `src/main.js` lines ~7399-7412 (the stub `'Lab mode stub — full keybinds 1–7 land in welldipper-lab-mode-2026-05-05...'` text panel) is removed. Shift+L's handler now calls `_labMode.toggleHud()` to show/hide the AC #2 overlay. With `?lab=1`, the HUD is visible by default; Shift+L hides it; Shift+L again re-shows it. Without `?lab=1`, Shift+L is a no-op (no panel appears). Verifiable: `grep "Lab mode stub" src/main.js` returns no matches; with `?lab=1`, Shift+L toggles `getElementById('lab-hud').style.display`.

12. **Tester invocation surface — `_labMode.runScenario(N)` programmatic entry exists.** In addition to keybind-driven entry, the module exports a programmatic API: `window._labMode.runScenario(N)` for N=1..7 invokes the same scenario-setup function as Shift+N would. This lets the Tester subagent invoke scenarios without simulating keypresses through chrome-devtools (which is brittle on the digit-key layer because Shift+N also affects other handlers depending on focus). Verifiable: with `?lab=1` in URL, calling `window._labMode.runScenario(3)` from console lands the same state as pressing Shift+3 manually, with `_labMode.lastEntrySnapshot` populated identically.

## Principles that apply

Per `docs/GAME_BIBLE.md` §11 Development Philosophy. Three principles are load-bearing here:

- **Principle 1 — Authored Experience Over Procedural Drift.** Lab-mode is dev tooling, not authored player experience, so this principle applies inverted: lab-mode SCENARIOS must be authored deterministically, not procedurally drift. Scenario 1 should produce the same starting state every time Max presses Shift+1; scenario 4 should land Max at the same point in the HYPER phase every time. Variance in scenario entry == variance in Max's evaluation surface == the iteration cycle leaking the same lossy-framing problem recordings had. The scenario-setup functions use seeded RNG (`?seed=N` URL param) and explicit positions; no fresh `Math.random()` calls. Violation: a scenario that lands Max at a different spot each press because the system loader picked a different planet sequence, or because warp's time-advance loop accumulated different RAF jitter.

- **Principle 2 — No Tack-On Systems.** The temptation here is to bolt scenario setup ad-hoc into `main.js` as a series of one-off URL params (`?warp-sol=1`, `?manual-flight=1`, etc.) instead of a unified `src/debug/LabMode.js` module + keybind layer + HUD overlay. Each one-off would compose with the others poorly (Shift+L for one stub, F-keys for another, query-string spaghetti) and the lab as a cohesive surface would never coalesce — recordings would stay the de-facto fallback by inertia. The dedicated module + unified gate + unified HUD is the structural-not-tack-on shape. Violation: scenario logic split across `main.js` + `LabMode.js` + a third file because "this scenario only needs one line"; or scenario keybinds with conflicting modifiers because "Shift+3 was free that day."

- **Principle 6 — First Principles Over Patches.** Patching the recording-evaluation cycle's time-cost and lossy-framing problems with better recording tools (longer captures, cleaner contact sheets, frame-extraction helpers) is the patch path. Relocating the felt-experience surface to an interactive lab Max can drive at sub-10-second iteration is the first-principles redesign. This brief is the well-dipper-side execution of that redesign. Violation: scope-creep adds "but also produce a fallback canvas recording at scenario entry just in case" — that's the patch path, structurally undoing the redesign.

## Drift risks

Three risks are load-bearing for this workstream. Concrete catches and guards below.

- **Risk: scope-creep on per-scenario polish.** "Just polish scenario 1 a bit more before moving to scenario 2" — and 4 hours later working-Claude has shipped a beautiful warp-from-Sol scenario with cinematic camera framing, exact reticle sub-pixel positioning, perfect star alignment, while scenarios 2-7 are still empty stubs. The lab is dev tooling; each scenario should be just-enough-to-iterate, not production-quality. Beautiful state-setup is a Layer-B-of-this-workstream concern, NOT in scope here.
  **Why it happens:** scenario polish feels like progress (visible improvements per minute) while scenario coverage feels like running in place (most scenarios produce structurally similar state-setup code).
  **Guard:** working-Claude's `LabMode.js` PR should land scenarios 1-7 each at ~30-50 LOC. If any single scenario function exceeds 80 LOC, stop and ask whether the scope-creep test is firing. Phase 2 ACs #4-#10 are equally weighted in the verification ladder; Tester PASS requires all seven. Polish to a single scenario beyond what the AC requires is OUT of this workstream's scope.

- **Risk: scene-inventory dependency drift — kit slips, lab-mode ships without snapshot capability.** The parallel sibling `motion-test-kit-scene-inventory-2026-05-05` may slip past this brief's execution window. If lab-mode hard-depends on the kit's technique #6 for AC #3 snapshots, this workstream blocks until kit ships — which would be the wrong shape. AC #3's "Forward-dependency-aware path + telemetry-only fallback path" is the explicit structural answer: if the kit is available, lab-mode uses it; if not, lab-mode uses telemetry-only state from existing exposed surfaces (`_autopilot.telemetry`, `_warpEffect.state`, `getComputedStyle` queries on key DOM overlays, `_navSubsystem` body-lock state).
  **Why it happens:** "we'll wait for the kit" is the path of least resistance because the kit's snapshot output is structurally cleaner than ad-hoc telemetry. But waiting blocks Max's regression triage path indefinitely.
  **Guard:** Phase 1 ships the telemetry-only fallback FIRST, before any kit dependency is wired. Working-Claude implements `captureEntrySnapshot()` as fallback-default; kit detection is a code branch added later (this workstream's Phase 4 amendment, OR a sibling-amendment workstream once both ship). The brief does NOT call kit-shipping a precondition. Tester verifies AC #3 against the fallback path even if the kit ships first; both paths must produce a populated snapshot.

- **Risk: conflicting keybinds — digit keys 1-9 are heavily used in well-dipper.** `src/main.js` line 7777-7788 binds digit keys 1-9 during autopilot to `_autoNav.jumpToStar()` / `_autoNav.jumpToPlanet()`; line 7820-7825 binds them outside autopilot to `focusPlanet()`. Plain-digit lab keybinds would collide on every scenario entry, breaking either the existing autopilot tour controls or the focus-mode planet selector. F-keys (F1-F7) collide with browser dev-tool / refresh shortcuts. Numeric keypad isn't reliable on laptops without one.
  **Why it happens:** the easy default ("press 1 to enter scenario 1") looks clean in the HUD overlay but breaks downstream functionality on entry — and worse, breaks it silently (the existing handlers fire too, producing scrambled scene state that ALSO looks like a scenario-setup bug).
  **Guard:** **Use Shift+digit (Shift+1..Shift+7) and Shift+L for HUD toggle.** Shift+digit is unused by existing handlers (the existing `e.key === '1'` handler at line 7777 doesn't gate on Shift; check whether `e.shiftKey` distinguishes here — it does, because `e.key` is `'1'` for plain-1 but `'!'` for Shift+1 in browsers, so the existing handler naturally wouldn't fire on Shift+digit). Phase 1 explicitly verifies the gate — pressing Shift+1 with `?lab=1` invokes lab scenario 1, NOT `_autoNav.jumpToStar()`. The handler placement in `main.js` is BEFORE the existing 1-9 handlers, with `e.shiftKey` as the discriminator on the digit branch. Phase 1's AC #1 includes a test that pressing plain-1 (without Shift) during autopilot still calls `_autoNav.jumpToStar()` — the gate must not regress existing keybinds.

- **Risk: lab-mode permanence — shortcuts become permanent dev cruft.** Per `feedback_build-dev-shortcuts.md`, dev-mode shortcuts are temp scaffolding, removed with the workstream. Lab-mode at scale is a different shape — it's intended to be persistent dev tooling that survives many workstreams. But the SAME risk applies at finer grain: a one-off "let me add a quick Shift+8 for this debug scene I'm working on" addition that never gets cleaned up, or scenario-specific code paths that leak into production behavior. The lab module needs a clear ownership boundary so "ad-hoc debug shortcuts that grew tendrils into production code" doesn't happen.
  **Why it happens:** lab-mode is so close to production code (in `src/`, imported by `main.js`, sharing `window._*` debug surfaces) that the boundary is fuzzy. Any scenario function CAN reach into production state, and small reaches accumulate.
  **Guard:** `LabMode.js` carries a comment-block header naming this workstream brief and stating: "This module is dev tooling. Scenario functions read from production state via the documented `window._*` debug surfaces ONLY; they do NOT mutate production state via private fields, monkey-patches, or direct module imports of internal types. If a scenario needs setup that the public debug surface doesn't expose, ADD it to the debug surface (in `main.js` with explicit `window._*` exposure) — do NOT reach around the surface." Working-Claude adheres to this on every scenario function.

## In scope

- New module `src/debug/LabMode.js` (~250-400 LOC total: 7 scenarios × 30-50 LOC + ~50 LOC infrastructure for HUD + snapshot + gate).
- Keybind wiring in `src/main.js`'s existing keydown handler (line ~7387), gated on `new URLSearchParams(location.search).has('lab')` AND `e.shiftKey`. Placement BEFORE existing 1-9 digit handlers so the gate intercepts before they fire.
- HUD overlay DOM element with all 7 keybinds + descriptions, gated on `?lab=1` in URL.
- Programmatic API `window._labMode.runScenario(N)` for Tester invocation.
- Replacement of the existing Shift+L stub panel block in `main.js` (lines ~7399-7412) with a `_labMode.toggleHud()` call.
- Telemetry-only fallback path for AC #3 entry-snapshot (does NOT depend on kit's scene-inventory shipping).
- Comment-block header in `LabMode.js` referencing this brief + the "dev scaffolding" framing per `feedback_build-dev-shortcuts.md`.
- Self-tests / harness at `tests/refactor-verification/welldipper-lab-mode-{1..7}-entry.html` (one harness per scenario OR one combined harness — working-Claude's call) that programmatically invoke each scenario via `_labMode.runScenario(N)` and assert the snapshot's structural properties match the AC.

## Out of scope

- **Per-scenario polish beyond AC requirements.** Cinematic camera framing, exact reticle positioning, polished entry animations — all are Layer-B work; future workstream territory.
- **Investigating or fixing the parked regressions** (reticle/runway-persist + warp-tunnel-second-half-missing). Lab-mode keybind 7 SETS UP the regression for investigation; the investigation + fix are separate workstreams.
- **Recording-as-default for any scenario.** Per the new rule, lab-mode IS the felt-experience surface; recordings remain the exception path for transient bugs that resist interactive reproduction. This brief does not author recording-side tooling.
- **Cross-project lab-mode template.** The scenario set is well-dipper-specific. A future workstream may distill the pattern (URL gate + scenario module + HUD overlay + entry snapshot) into a reusable template across game-shaped projects, but that is not this brief's deliverable.
- **Scene-inventory implementation.** The parallel sibling `motion-test-kit-scene-inventory-2026-05-05` ships scene-inventory at the kit. This brief consumes it via fallback-or-detect; it does NOT author scene-inventory.
- **Production keybind changes outside the lab gate.** Existing keybind handlers (1-9 for `jumpToStar` / `focusPlanet`, Tab for tour-advance, Q for autopilot toggle, etc.) are not touched. The lab keybind layer is additive; it intercepts before existing handlers ONLY when `?lab=1` is in URL AND Shift is held.
- **Removing the lab-mode itself once shipped.** This is intentional persistent dev tooling; treated as long-lived scaffolding (per the `feedback_build-dev-shortcuts.md` exception for tooling that pays back across many workstreams).

## Handoff to working-Claude

Read in order: (1) `~/.claude/projects/-home-ax/memory/feedback_lab-modes-not-recordings.md`, (2) this brief end-to-end, (3) the Shift+L stub block in `src/main.js` lines ~7399-7412, (4) the existing keydown handler in `src/main.js` lines 7387-7826 to understand the digit-key conflict surface, (5) `docs/PERSONAS/tester.md` §"Production-grade verification (post-migration)" for the bug-class table that names lab-mode as the felt-experience-class technique, (6) `docs/WORKSTREAMS/welldipper-fixed-timestep-migration-2026-05-03.md` AC #17 Layer B for the stub being replaced.

Build order: Phase 1 (infrastructure: gate, HUD, snapshot, fallback) → Phase 2 (seven scenarios, in order Shift+1 through Shift+7) → Phase 3 (stub retirement + Tester programmatic surface). Each Phase landed = one Tester invocation. Phase 1 is the load-bearing one — get the gate right BEFORE writing scenario code; if the gate is wrong, every scenario inherits the bug.

What "done" looks like:
- All 12 ACs satisfied. Tester PASS at the to-be-shipped commit.
- `src/debug/LabMode.js` exists with 7 scenario functions averaging ~30-50 LOC each + the infrastructure helpers.
- `src/main.js` keydown handler imports `LabMode`, wires Shift+digit + Shift+L gates, retires the stub panel block.
- Tests at `tests/refactor-verification/welldipper-lab-mode-*.html` exist and pass.
- HUD overlay is visible when `?lab=1` is in URL; lists all 7 scenarios + Shift+L toggle.
- Pressing Shift+N (N=1..7) with `?lab=1` lands Max in the named scenario deterministically; `_labMode.lastEntrySnapshot` populated.
- Pressing plain digits (no Shift) still invokes existing `_autoNav.jumpToStar()` / `focusPlanet()` handlers without regression.

What artifacts to produce:
- One commit per Phase (3 commits total) OR one combined commit at workstream end — working-Claude's call based on Tester invocation cadence.
- Self-test harness HTML files at `tests/refactor-verification/`.
- `LabMode.js` carries comment-block header naming this brief + the dev-scaffolding framing.
- No canvas recordings as default deliverable. The lab IS the felt-experience surface; Max evaluates interactively.

Tester invocation pattern (per `docs/PERSONAS/tester.md`):
```
Agent(subagent_type="tester",
      description="Verify welldipper-lab-mode-2026-05-05 Phase N",
      prompt="Brief: docs/WORKSTREAMS/welldipper-lab-mode-2026-05-05.md
              Commit-under-test: <SHA>
              ACs to verify: <list>
              Verify via chrome-devtools: load http://localhost:5173/?lab=1,
              press Shift+N for each scenario, capture _labMode.lastEntrySnapshot,
              assert structural properties per ACs.")
```

After Tester PASS at all 12 ACs and a commit covering the full workstream, flip Status to `Shipped <SHA>` (no recording suffix; lab IS the felt-experience surface). Push origin per `feedback_push-on-shipped.md` (well-dipper is on the established-deploy list).

## Open questions

1. **Should keybind 4 (mid-HYPER) pause the warp animation, or let it run?** Pausing gives Max a static mid-tunnel evaluation surface but loses the felt-experience of motion through the tunnel. Letting it run means Max has a ~3-second window to evaluate before warp exits. Working-Claude proposes letting it run (pause is a recording-shaped artifact; lab-mode's value is interactive felt-experience, including motion). Max can confirm or override.

2. **Should keybind 7's reproducer state be captured into a "regression sentinel" snapshot for golden-trajectory regression testing?** AC #10 names this scenario as a future regression sentinel — once the bug is fixed, pressing Shift+7 shouldn't reproduce it. A natural extension is to commit a golden snapshot of "what Shift+7 SHOULD look like post-fix" once the fix lands, and have the snapshot diff'd in CI. This would land in a follow-up workstream; flagging here so it doesn't get scope-crept into this one.

3. **Is `?lab=1` the right gate, or should it be more discoverable (e.g., a settings-panel toggle)?** A URL param is invisible to users not aware of it (the right shape for dev tooling Max doesn't want shipping to end-users). A settings toggle is more discoverable but also more findable by curious users navigating the production site. Working-Claude proposes URL-param-only for V1; settings-toggle as a future enhancement if Max wants the lab discoverable for cross-device testing.

---

*Brief authored by PM 2026-05-06 against well-dipper HEAD `3345e40` (post fixed-timestep migration Shipped + Phase 5 amendment). Parallel sibling to `~/projects/motion-test-kit/docs/WORKSTREAMS/motion-test-kit-scene-inventory-2026-05-05.md`. No parent feature doc — dev-tooling workstream per `docs/PERSONAS/pm.md` §"Carve-out: process / tooling workstreams." Replaces the Shift+L stub from migration brief AC #17 Layer B.*
