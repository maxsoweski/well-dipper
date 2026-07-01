# Flight Reliability Program — Plan (2026-06-30)

**Line of sight:** the unattended Orrery screensaver tour (tour → warp → repeat) is the travel-loop
foundation of the **35% SCREENSAVER heart** and the first GAME-tier player-flight capability. Phase-1 audit
+ Phase-2/3 live verification proved it can **freeze permanently**. This program fixes every confirmed
finding *and* stands up a periodic regression suite so we can keep checking, as we fix, that both the
specific bugs stay dead AND the larger Orrery+HELM flight function still works as it should.

**Inputs (read these first):**
- [`FLIGHT_AUDIT_2026-06-30.md`](FLIGHT_AUDIT_2026-06-30.md) + `.map.json` — Phase-1 code/intent map (85 aspects, per-aspect `liveTestRecipe`).
- [`FLIGHT_AUDIT_2026-06-30_PHASE2_RESULTS.md`](FLIGHT_AUDIT_2026-06-30_PHASE2_RESULTS.md) — Phase-2/3 live verification (evidence for everything below).

**Execution model (Max's direction):** fresh session, driven by **workflows**. Each fix = a
`dev-collab-scope` workstream (`intent.md` + `contract.json`) → `writing-plans` → `Workflow` build (TDD →
adversarial review → file-scoped commit) → working-Claude live integration checks (chrome-devtools) →
`VERIFIED_PENDING_MAX` → **Max UAT** → Shipped. Never flip UAT ACs to PASS (Max's gate alone).

---

## A. Fix workstreams (priority order)

### WS-1 — CRUISE stall-detector / no-freeze guard  ⭐ build first (HIGH)
**Fixes:** #1 star-wedge (permanent freeze), and mitigates #3 (fast-moon non-convergence) + the null-`bodyRef`
tour stall — all three are "phase stuck CRUISE, `dist` never reaches 10R, `motionComplete` never fires."
**Root cause:** `SupercruisePilot` CRUISE has no timeout; pure pursuit through obstacles (`aimAssist.steerToward`).
**Approach:** add a stall detector to the pilot/tour: track `dist`-to-target while in CRUISE; if it fails to
decrease by more than a small threshold over a rolling window (~10–15s) — the common signature of ALL freeze
flavors (barrier-pinned, forced-drop-pinned, drive-off crawl, fast-moon limit-cycle, null-ref no-target) —
**abort the leg**: for a tour, advance to the next stop (skip-and-continue); for a standalone Assist leg, drop
out gracefully. Add the null-`bodyRef` skip-guard in the same change (main.js:6852–6864).
**ACs (draft — refine in scope):**
- A forced star-crossing tour leg **recovers** (tour advances) within the stall window + margin; the tour is
  never permanently frozen.
- A leg whose `dist` is legitimately still decreasing is **never** falsely aborted (no regression on normal legs).
- A null-`bodyRef` stop is skipped, tour continues.
- Fast-orbiting-moon leg (high `celestialTimeMultiplier`) that can't converge is aborted, tour continues.
**Test layer:** unit (stall logic on synthetic `dist` series — captures/aborts correctly) · integration
(lab-forced star-crossing leg → assert recovery; full-tour-completes) · live (working-Claude drives) · UAT.
**Evidence to reproduce:** Phase-2 §1 (deterministic real-class runs + live Assist-to-Jupiter freeze).

### WS-2 — Roll preserved on HELM→ORRERY exit (HIGH — we introduced it)
**Fixes:** #5 roll-snap. **Root cause:** `adoptCurrentPose` (ShipCameraSystem.js:732) ignores `camera.up`;
`_applyOrbit` (:517) `lookAt` re-levels to world-up.
**Approach:** carry the ship's roll (camera's rolled `up`) through the exit anchor so the Toy-Box orbit adopts
the current banked orientation, or ease the roll out over a few frames instead of snapping. Keep the existing
no-snap position/look-dir contract (`flightExitAnchor` drift-guard test — update it in lockstep).
**ACs (draft):** exit while rolled preserves roll (or eases it, no 1-frame snap); exit while level unchanged
(no regression on the shipped no-snap exit); `flightExitAnchor.test.js` updated.
**Test layer:** unit (roll-preservation math) · live (roll 45°, M-swap, assert camera roll continuous) · UAT.
**Evidence:** Phase-2 §5 (live 45°→0° snap measured).

### WS-3 — ORRERY focus-burn cancellable / proper engage door (HIGH)
**Fixes:** #4 uncancellable ORRERY burn. **Root cause:** `focusPlanet/Star/Moon` (main.js:6504+) set ASSIST +
`flyTo({linger:Infinity})` without `setScManual`, so the `manualCancelsLeg` gates (inside `if (_scManual)`)
never fire; Escape (main.js:9331) only deselects.
**Approach:** route player-directed `focus*` burns through the proper engage door (mirror `commitBurn`'s
`setScManual(true)` / HELM swap), and/or make Escape call `scPilot.stop()` when a `focus*` burn is active in
ORRERY. Fold into the A2 Orrery-nav work if scoped together.
**ACs (draft):** a `focus*` burn (number key / minimap) is cancellable by W/S/stick/Escape; label/mode reflect
the true state; no regression to the autopilot tour or `commitBurn`.
**Test layer:** unit (engage-door state) · live (start focus-burn, cancel via each input) · UAT.
**Evidence:** Phase-2 §4 (live — Escape/W/S all failed to cancel).

### WS-4 — celestialTimeMultiplier / moon-capture (MED, likely subsumed)
**Fixes:** #3. Largely mitigated by WS-1 (a non-converging fast-moon leg gets aborted rather than freezing).
**Decide during WS-1 scope:** is "abort + skip" enough, or do we also want a target-lead term in
`steerToward` so fast moons are actually *captured* (nicer, but more change)? Default: rely on WS-1's abort;
revisit lead only if Max wants high-multiplier moon visits to succeed rather than skip.

### WS-5 — Small / deferred cleanups
- **Idle-reengage "moon-flip"** (main.js:8017–8026): suppress the random-tour reengage while the player is
  deliberately parked at an Assist target (add a "parked" flag). Low priority.
- **HUD null-deref nit** (SupercruiseHud.js:174 reads `state.deflection.x` unguarded) — one-line guard.
- **#2 repeat-warp degradation** — **does not reproduce** (19/20, warps 7–20 clean). Action: **close** the
  deferred `well-dipper-warp-entry-rootcause` finding #4 concern (optionally one confirmatory re-run).

---

## B. Periodic / regression testing (the "keep checking it works" ask)

Two layers, run after every fix and as a standing check:

**1. Headless unit tests (vitest)** — pure logic, fast, deterministic, every build:
- CRUISE stall-detector (aborts on frozen `dist`, never on decreasing `dist`).
- Roll-preservation exit math.
- Null-`bodyRef` skip-guard.
These carry the bulk of regression protection and are cheap to run continuously.

**2. Lab-driven flight-reliability suite** — extend `src/debug/integration-suite.js` (home of
`runWarpEntrySuite`) with **`runFlightReliabilitySuite()`**, driven live via `_lab` + chrome-devtools. Checks:
- **Full-tour-completes** (the holistic screensaver check): `_lab.beginAutopilotTour()` at low
  `tourLingerMultiplier`; assert every leg reaches HOLD and the tour wraps — no leg stuck in CRUISE. Catches
  wedge / null-ref / non-convergence regressions in one shot.
- **Wedge-recovery**: force a star-crossing leg (this session's teleport recipe); assert the tour recovers
  within the stall window.
- **Roll-preserved-on-exit**: roll 45° in HELM, M-swap, assert camera horizon-roll is continuous.
- **Focus-burn-cancellable**: number-key focus-burn, then W/S/Escape, assert it cancels.
- **Moon-capture-under-time-multiplier**: high `celestialTimeMultiplier`, moon leg, assert capture-or-clean-skip.
- Keep **`runWarpEntrySuite`** as the warp-loop regression (already green 19/20).

**3. Broader Orrery+HELM functional smoke:** the Phase-1 map's 85 aspects each carry a `liveTestRecipe`. Curate
a subset (the "works" aspects + everything we fix) into the suite so "is the whole flight system still
functionally correct" is a repeatable check, not a memory.

**Cadence:**
- **Per fix:** `verify-workstream` workflow against that WS's contract (unit + integration + 3× adversarial) +
  working-Claude live integration checks.
- **After each WS lands & periodically:** run `runFlightReliabilitySuite()` + `runWarpEntrySuite()` (a subagent
  can drive these) and eyeball the full-tour-completes result. This is the standing "does Orrery+HELM still
  work" gate.
- **UAT** (does it feel right as a whole) stays Max's gate alone.

---

## C. Sequencing

1. **WS-1** (CRUISE stall-detector + null-ref guard) → build `runFlightReliabilitySuite()` alongside → verify →
   this is the baseline standing suite.
2. **WS-2** (roll-on-exit) → verify + suite.
3. **WS-3** (focus-burn cancellable) → verify + suite.
4. Re-run the full suite + a real unattended-loop soak; close #2; decide WS-4 lead vs skip; mop up WS-5.

Each step: `dev-collab-scope` → `writing-plans` → `Workflow` build → live integration checks →
`VERIFIED_PENDING_MAX` → Max UAT. Do not push / touch NOW.md until Max UAT closes a WS.

## D. Guards / gotchas (carried from this session)
- **Scale-bug floors** (`SC_TUNING` cap/hold) are scale-free for production radii — **never re-tune** (two prior
  live regressions). Reusing the drop-window math (10R / (10R)/2.5) is fine.
- **Live-drive faithfully:** the autopilot's own control loop fights manual teleports — prove pilot/model
  mechanisms with fresh-instance unit tests (real classes via `window._sc.model.constructor`), reserve live
  drives for emergent/whole-loop checks. Keep the window **foreground** (rAF throttles when occluded → false
  freezes). Don't `JSON`-return THREE meshes (1.2M-char blowup); return compact scalars.
- Concurrent **World-Engine** track runs in *other* worktrees — do not touch them. This work lives only in
  `~/projects/well-dipper-supercruise` on `feature/supercruise-freelook`.
