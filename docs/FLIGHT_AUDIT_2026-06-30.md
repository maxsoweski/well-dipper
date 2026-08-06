# Flight Systems Audit — Orrery + HELM (2026-06-30)

**What this is:** a systematic per-aspect audit of Well Dipper's flight systems, asking of every
piece: *what is it supposed to enable for its mode → does it → what's off/missing?* Produced by the
`flight-systems-audit` workflow (`wih7z2c3q`, 10 agents / ~1.6M tokens), synthesized by working-Claude.

**Line of sight:** flight (Orrery god's-eye + HELM hands-on) is the player's whole means of moving
through a system — the travel-loop foundation of the 35% SCREENSAVER heart and the first GAME-tier
player-flight capability. Reliability of the *unattended screensaver loop* (tour → warp → repeat) is
the driving quality axis.

**Full per-aspect detail (intended → actual file:line → status → issues → live-test recipe):**
[`FLIGHT_AUDIT_2026-06-30.map.json`](FLIGHT_AUDIT_2026-06-30.map.json) (85 aspects) + its
`completenessCritic`. This MD is the prioritized synthesis; the JSON is the source of truth for recipes.

**Coverage:** 85 aspects across 9 clusters — **47 works · 31 suspect · 6 gap · 1 unknown**.
This is a CODE/INTENT map (Phase 1). **Phase 2 = live behavioral verification (not yet run)** — the
recipes exist but no aspect below has been driven live yet except where noted. Treat "suspect" as
"code reads wrong / unverified," not "confirmed broken."

> **Audit-coverage gap (fix in a follow-up sweep):** the workflow had no dedicated **HUD cluster**, so
> `src/ui/SupercruiseHud.js` (speed/throttle/drop-window/mode readouts) is largely unaudited. The critic
> flagged this + DPR/resize, pointer-lock-loss, stick-tuning-not-persisted, and flight-audio-absent. See
> critic §(a)/(b).

---

## 1. RELIABILITY — the autopilot tour+warp loop (the driving question)

**Answer: conditionally NO — the unattended loop has concrete deadlock/degradation vectors.** The
contract's "tour completes ALL bodies and re-warps without input" (AC8) is an *invariant that only holds
conditionally* (critic §(d)1). Verify these live FIRST (Phase 2):

- **[HIGH] Star/planet-occlusion CRUISE wedge → permanent tour freeze.** CRUISE has **no timeout** (only
  ALIGN does). The pilot is pure pursuit (`aimAssist.js:46`, no lead) steering straight at the target's
  live position through any intervening body. When a leg's straight line is blocked by the star (planet→
  planet on opposite sides) or a planet occluding its own moon, the collision barrier
  (`SupercruiseModel.js:176-189`) stops forward motion, `speedCap` collapses, dist never reaches 10R,
  CRUISE never exits, `motionComplete` never fires → **screensaver freezes on that leg forever.**
  Opposite-side orbital geometry *will* occur over long runs. This is the #1 finding.
- **[HIGH] Null body-ref stop → tour hangs.** If a stop's `bodyRef` is null (mesh failed to spawn), the
  advance skips `flyTo` but leaves `_scLegAdvanced` set (`main.js:6852-6865`) → tour freezes; no
  skip-and-continue guard.
- **[HIGH] Repeat-warp degradation after ~7 warps** — the historical `well-dipper-warp-entry-rootcause`
  finding #4: progressive entry-miss accumulation, **mechanism never pinned, DEFERRED**. Code evolved past
  the memory (`_advanceDir` now uses `_destForward`, `main.js:7676`), so re-verify with
  `window.__wd.runWarpEntrySuite({warps:20})` from one `enterSol`, foreground, watching warps 7–20.
- **[HIGH] Backgrounded-tab throttle = the real screensaver runtime.** Sim is rAF-gated + clamped
  (`maxStepMs:100`, `main.js:6795`); an occluded/background tab throttles the sim to ~1fps while wall-clock
  `setTimeout` retries (nav-computer drill-down) keep firing → drill-down aborts + timer/sim desync. No
  aspect tests multi-minute backgrounded endurance + return-to-valid-state (portal idle, `warpEffect`
  idle, no NaN). Critic §(c)2.
- **[MED] `celestialTimeMultiplier` (Settings, −10000×…+10000×) amplifies the wedge.** At a high saved
  multiplier a fast-orbiting inner moon outruns the ship's closing rate → CRUISE limit-cycle → freeze;
  negative (retrograde) sweeps collision bodies backward through the pursuit line. Settings-reachable
  screensaver break. Critic §(c)1.
- **[MED] Tour-complete cinematic auto-warp** self-heals to a plain warp on star-load timeout, but
  degrades exactly in the backgrounded state; also a latent coupling where a slow drill-down can advance
  the tour in the background before the warp dispatches.

## 2. Camera snaps / transitions

- **[HIGH — NEW] Roll snap on HELM→ORRERY exit.** The no-snap exit re-levels the horizon
  (`adoptCurrentPose`→`_applyOrbit`→`lookAt` with `up=(0,1,0)`, `ShipCameraSystem.js:509-518`): position +
  look-dir preserved, **roll discarded** → visible snap-to-level if the ship was rolled. **Q/E roll was
  only added 2026-06-30 and is untested against the exit path** — directly caused by this session's work.
- **[HIGH] Persisted `wd_cameraMode='flight'` landmine.** Quit-in-HELM persists `'flight'`
  (`ShipCameraSystem.js:437`); nothing on the ORRERY boot/reveal path forces `TOY_BOX`. After booting the
  ORRERY tour, if the tour is stopped (Z), the FLIGHT branch runs → CinematicDirector chase offset →
  camera **jumps to a chase shot**. Resurrectable dead path.
- **[MED] `CameraChoreographer` is dormant dead-weight** (only driver `FlythroughCamera` is
  `SHIPS_ENABLED=false`-gated) but still constructed + rebase-tracked every frame; reviewers may wrongly
  think it authors the tour camera.

## 3. HELM flight-mode inconsistencies

- **Three HELM-entry doors set `_flightMode` by three different rules** (`_enterFlightInternal` reads
  Settings; commit-burn-swap + tour-takeover set it inline). M-swap-to-HELM with Settings=Assist/Align +
  a selected body **silently starts an Assist leg and begins cruising** (drive defaults ON, no `setDrive`)
  — contradicts the mode-restructure spec's "swap stations only, drive untouched" (critic §(d)2).
- **Roll (Q/E) does NOT cancel an Assist leg** (inconsistent with W/S + stick, which do); with no B2
  auto-level the stray bank persists.
- **Align silent partial:** strict `ALIGN_DOT=0.995` vs a moving body → hits the 1.5s cap with nose
  slightly off; W/S does not cancel Align (only stick does).
- **Assist ~55s non-convergence + moon-flip** is really the SELECTION-layer idle-reengage (random tour),
  NOT the pilot re-targeting — the spec's diagnosis conflates them; every successful Assist arrival is
  eventually yanked into a random tour (no "deliberately parked" suppression).

## 4. Thread A gaps (Orrery nav UX) + the uncancellable ORRERY burn

- **[GAP] A2 (Orrery body-click → ~0.3s eased god's-eye reframe) — UNBUILT.** Same planet behaves
  differently by where you click: 3D-scene click SELECTS (no move); minimap click flies a **full
  supercruise burn**.
- **[GAP] A3 (second-click-on-selected-star commits warp) — UNBUILT.** Only manual warp commit is Space's
  3-stage preview (needs 3 presses; a single Space does *not* warp).
- **[HIGH] The ORRERY minimap/keyboard burn is UNCANCELLABLE.** `focusPlanet/Star/Moon` (also number keys
  1–9 + Tab, critic §(a)4) set `bypassed=true` + `flyTo({linger:Infinity})` + `_flightMode=ASSIST` but
  **never `setScManual(true)` and never swap to HELM** → the manual-cancel gates (inside `if(_scManual)`)
  never fire; Escape doesn't call `scPilot.stop()`. The burn parks forever in a pilot-held orbit while the
  label still says ORRERY; only M or Z escapes it. (A2 should fix the design here.)

## 5. Verify LIVE first (Phase 2 order — from the critic §(e))

1. **Star-occlusion CRUISE wedge** — ≥6 warp+full-tour cycles; watch for `pilot.phase` stuck CRUISE,
   `speed≈0` at ~1.05×starRadius. Gates AC8.
2. **Repeat-warp degradation** — `window.__wd.runWarpEntrySuite({warps:20})`, foreground; entry+emergence
   20/20, attention warps 7–20.
3. **`celestialTimeMultiplier` stress** — set ~1000×, run a tour to an inner moon + an Assist leg to a
   fast planet; assert capture or document amplified non-convergence.
4. **Backgrounded-tab endurance** — ORRERY loop, background ~20 min, return; assert `warpEffect` idle,
   `_portalLabState==='idle'`, `_autoNav.isActive`, `_cc._diagnostics.getSummary().nanCount===0`.
5. **ORRERY focus-burn cancellability** — number-key `3` in non-autopilot ORRERY, then Escape + W/S;
   confirm it cannot be cleanly cancelled.

**Live-test setup:** dev server `:5173/well-dipper/`; debug Chrome on `:9223`
(`"…/chrome.exe" --remote-debugging-port=9223 --user-data-dir="C:\temp\chrome-mcp-filmstrip"
"http://localhost:5173/well-dipper/"`). **Keep the window focused/foreground** — an occluded window
throttles rAF to ~1fps and freezes motion (also *the* thing finding §1 background-throttle is about). Reset
zoom to 100% (Ctrl+0) in that profile. Hooks: `window._getState/_sc/_cam/_scene/_autoNav/_warpTarget/
_autoSelectWarpTarget/_commitSelection/_beginWarpTurn/__wd.runWarpEntrySuite`.

## Deferred / known (not new)

- **B2 per-mode roll auto-level** — DEFERRED/unbuilt (ASSIST should auto-level released roll; the whole
  §B2 corrector, +Y reference, degeneracy skip are absent). No spec-vs-code reconciliation note exists.
- **Ships dormant** — `SHIPS_ENABLED=false` (`main.js:152`): all "ship" suspected-issues are latent, not
  shipping-reachable (critic §(c)3).

---

**Next (Phase 2/3, fresh session):** drive the §5 items live (working-Claude via chrome-devtools),
adversarially confirm each "suspect→broken" before acting, then scope fixes as workstreams — likely
lead with the CRUISE-timeout/wedge guard (biggest reliability win) and the roll-on-exit snap (we caused
it). A2/A3 remain unbuilt features (spec `2026-06-28-orrery-nav-and-roll-controls`).
