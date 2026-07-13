# Flight Audit — Phase 2/3 Live Verification Results (2026-06-30)

**What this is:** results of driving the Phase-1 audit's top findings *live* (chrome-devtools on
`:9223`/`:5173`, real Sol geometry) + adversarial code confirmation. Phase-1 map + synthesis:
[`FLIGHT_AUDIT_2026-06-30.md`](FLIGHT_AUDIT_2026-06-30.md) / `.map.json`. Method: `superpowers:systematic-debugging`
(reproduce before any fix). Every claim below is backed by a live measurement or a deterministic run of the
**real** `SupercruiseModel`/`SupercruisePilot` classes (fresh instances, no game-state side effects).

**Driving question — "is the autopilot screensaver working repeatedly?" → definitively NO.**
The unattended tour can **freeze permanently**, from a single root cause with three surface flavors (below).

---

## 1. [HIGH] CRUISE star-wedge → permanent screensaver freeze — CONFIRMED

**Root cause (code, definitive):** `SupercruisePilot.update()` gives ALIGN a timeout (`ALIGN_TIMEOUT 8s`) but
**CRUISE has none** — it only exits when `dist ≤ 10R`. The pilot is pure pursuit (`aimAssist.steerToward`, no
lead, no obstacle avoidance). So a leg whose straight ship→target line is blocked by the star (or a planet
occluding its own moon) never reaches `dist ≤ 10R`, CRUISE never exits, `motionComplete` never fires, the tour
never advances.

**Deterministic reproduction** (real classes, real Sol star radius **4.65**, nose pre-aligned = post-ALIGN CRUISE):
sweeping the ship→target line's offset from the star center —
| line offset from star | result over 40–60s |
|---|---|
| 0 (antipodal) | pinned at collision barrier **4.883u, speed exactly 0, CRUISE forever, never HOLD** |
| 2u | pinned, crawling 0.0125 u/s — effectively permanent |
| 5u | pinned ~30s, then slow-crawls off the limb |
| 10u (line clears star) | no wedge — slows then accelerates through cleanly |

So a leg wedges — permanently for near-antipodal geometry — whenever its straight path passes within ~2× the
star barrier.

**Live in-game confirmation** (real pilot + real main.js, HELM-Assist leg to Jupiter through the Sun): the ship
decelerated into the star's **forced-drop safety horizon (~18u)**, `proximityDropRequired()` force-dropped the
drive every frame (nose inbound), and it **froze at ~18u, drive off, crawling at sublight 0.0015 u/s (224 km/s),
phase CRUISE, for the full 25s sample** — `dist`-to-target pinned at 5221, `active:true` throughout. Screenshot:
ship nose-locked into the Sun, HUD "SUBLIGHT / 224 km/s", target brackets occluded behind the star.

**Two pin flavors, same root cause:**
- **ORRERY tour** (`_scManual` false → no main.js forced-drop): pins on the **collision barrier** at `1.05×starR`
  (unit test), speed 0.
- **HELM-Assist / commit-burn** (`_scManual` true): force-dropped at the star's **~18u horizon** (live), sublight crawl.
- Both are permanent; the tour/leg never advances.

**Frequency:** planets in Sol are coplanar; over an unattended run, near-antipodal planet→planet legs *will* occur,
and **planet-occludes-its-own-moon** legs (roughly half the queue) are a more frequent second vector. Not rare over
a night-long screensaver run; once triggered it is permanent.

**Fix direction:** a CRUISE **stall detector / timeout** — if CRUISE runs > N s without `dist` decreasing (or
speed pinned near 0 / drive force-dropped while phase=CRUISE), **abort the leg and advance the tour** (skip-and-continue),
optionally with a simple obstacle-aware re-route. This single guard covers all three pin flavors (barrier, forced-drop,
drive-off) and gates AC8. Biggest reliability win — build first.

## 2. Repeat-warp degradation after ~7 warps — DOES NOT REPRODUCE (appears resolved)

`window.__wd.runWarpEntrySuite({warps:20})` from one `enterSol`, foreground: **19/20 REGISTERED, verdict
`ALL_REGISTERED`**, 0 precision-suspect, 0 off-axis-suspect. **Warps 7–20 all registered (14/14)** — the historical
"~7-warp degradation" (memory `well-dipper-warp-entry-rootcause` finding #4, mechanism never pinned, DEFERRED) did
NOT manifest on current code. The single non-registration was warp #1 = `NO_OUTSIDE_A_FRAMES` (a trace-capture
timing artifact — no approach frames seeded — *not* a `MISSED_GATE_REJECT`/off-axis miss). The audit's
"re-verify since code evolved past the memory" resolves clean. Recommend closing the deferred concern (optionally
re-run once to confirm the 1 trace artifact is instrumentation, not signal).

## 3. [MED] celestialTimeMultiplier amplifies non-convergence — CONFIRMED

`celestialTimeMultiplier` (Settings, ±10000×) scales `celestialDt` (main.js:6956) → orbital speed. Unit test of a
moon-leg capture vs orbital rate (ship at a realistic planet hold-point):
| moon orbital ω | ~× realtime | captures? |
|---|---|---|
| 0 | ~1× | ✅ HOLD @17.6s |
| 0.01 | ~143× | ✅ HOLD @19.9s (slower) |
| 0.05 | ~714× | ❌ CRUISE forever |
| 0.2 | ~2857× | ❌ CRUISE forever |
At realtime a moon is captured; above ~a few-hundred× the pure-pursuit pilot (no target lead) can't close on the
fast-orbiting moon → CRUISE limit-cycle → tour freeze. A saved high multiplier (Settings-reachable) breaks moon
capture. Same root family as #1; a CRUISE stall-detector also mitigates this (aborts the non-converging leg).

## 4. [HIGH] ORRERY focus-burn is uncancellable — CONFIRMED (live)

In non-autopilot ORRERY, number keys `1`–`9` (main.js:9346) and minimap clicks (main.js:2752) call `focusPlanet()`
directly. `focusPlanet` sets `_flightMode = playerBurnMode()` (ASSIST) + `scControls.flyTo({linger: Infinity})` but —
unlike the `commitBurn` path (main.js:6310) — **never calls `setScManual(true)` and never swaps to HELM**. The
`manualCancelsLeg` gates live inside `if (_scManual)`, so W/S/stick can't cancel; Escape (main.js:9331) routes to
`focusPlanet(-1)` (deselect only, no `scPilot.stop()`).

**Live:** pressed `3` → pilot ALIGN→HOLD, active, mode ORRERY. Escape, W, and S **all failed to cancel** (pilot
stayed HOLD/active in ORRERY, `linger:Infinity`). Only **M** escaped it. (`controls.getState().mode` stayed `null`
throughout — the controls surface never registered the burn as engaged, corroborating the bypassed engage door.)

**Fix direction:** route `focus*` player-burns through the proper engage door (set `_scManual` / swap to HELM like
`commitBurn` does), and/or make Escape call `scPilot.stop()` in ORRERY. Folds naturally into the A2 Orrery-nav work.

## 5. [HIGH — we introduced it] Roll-snap on HELM→ORRERY exit — CONFIRMED (live)

`adoptCurrentPose()` (ShipCameraSystem.js:732) back-solves yaw/pitch/distance but **never touches `camera.up`**;
`_applyOrbit()` (:517) ends with `camera.lookAt(target)`, which derives orientation from world-up `(0,1,0)`. So a
rolled HELM camera exiting to Toy-Box is re-leveled — position + look-dir preserved, **roll discarded**. The Q/E
roll write (main.js:8140) is also never reset on mode transitions.

**Live:** rolled the ship 45° in HELM (camera horizon-roll −45°), pressed M → **snapped to 0° (level)** in ORRERY.
Directly caused by adding Q/E roll (2026-06-30) without preserving it through the exit anchor.

**Fix direction:** preserve roll through the exit — carry the camera's rolled `up` (or the ship bank) into the
Toy-Box orbit instead of forcing world-up in `lookAt`, or ease the roll out rather than snapping.

## Also code-confirmed (task-6 sweep, lower priority)

- **Null-`bodyRef` tour freeze (latent):** main.js:6852–6864 sets `_scLegAdvanced=true` + advances the index, but if
  `nextStop.bodyRef` is null the `flyTo` is skipped → tour freezes with no leg. Low frequency (all 40 Sol stops had
  refs; only fires on a mesh-spawn failure). A skip-and-continue guard fixes it (same guard family as #1).
- **Idle-reengage "moon-flip":** main.js:8017–8026 — a parked Assist/commit-burn arrival (`_manualBurnOrbiting`)
  counts to `idleTimeout` then `startFlythrough()` (random tour). Every deliberate park is eventually yanked into a
  random screensaver tour; no "parked" suppression. (The audit's ~55s observation implies a lowered `idleTimeout` in a
  saved profile; default is 300s.)
- **HUD nit:** `SupercruiseHud.update()` reads `state.deflection.x` unguarded (line 174) inside the reticle block — a
  render-frame crash if `deflection` is ever omitted. Low severity (main.js controls the state shape).

## Recommended build order

1. **CRUISE stall-detector / timeout** — the #1 reliability win; kills the permanent freeze (all three flavors) and
   mitigates #3. Gates AC8. Scope as a `dev-collab-scope` workstream → build → `verify-workstream`.
2. **Roll-on-exit snap (#5)** — we introduced it; small, self-contained (preserve roll through `adoptCurrentPose`).
3. **ORRERY focus-burn cancellability (#4)** — fold into the A2 Orrery-nav work (`focus*` through the engage door +
   Escape→stop).
4. Then the unbuilt A2/A3 Orrery-nav features (spec `2026-06-28-orrery-nav-and-roll-controls-design.md`).

**Deferred/optional:** null-bodyRef guard (roll into the #1 fix), moon-flip suppression, HUD nit, and a full
adversarial sweep of the remaining ~25 lower-priority "suspect" aspects (Phase-1 map) — a good parallel `Workflow`
if desired.
