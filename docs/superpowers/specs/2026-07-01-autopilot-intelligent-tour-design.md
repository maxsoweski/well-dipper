# Obstacle-Aware Intelligent Autopilot Tour — Design

**Date:** 2026-07-01 · **Branch:** `feature/supercruise-freelook` (continues the
supercruise / flight-reliability arc) · **Status:** DRAFT for Max's review.

> **Provenance.** Continues the flight-reliability program
> ([`docs/FLIGHT_RELIABILITY_PROGRAM_2026-06-30.md`](../../FLIGHT_RELIABILITY_PROGRAM_2026-06-30.md)).
> WS-1 (the CRUISE stall-detector / no-freeze guard,
> [`docs/WORKSTREAMS/cruise-stall-detector-2026-07-01/`](../../WORKSTREAMS/cruise-stall-detector-2026-07-01/))
> reached `VERIFIED_PENDING_MAX` but left a **residual livelock at the star** as an
> explicit non-goal. This spec solves that residual and builds out Max's broader
> "make the autopilot genuinely intelligent" vision. **Increment 4 evolves** the
> approved peer-mode design
> ([`2026-06-27-orrery-helm-mode-restructure-design.md`](./2026-06-27-orrery-helm-mode-restructure-design.md))
> — see the flag in that section.

## Line of sight

Serves the **35% SCREENSAVER** milestone: the unattended Orrery autopilot tour **is**
the screensaver — its job is to run indefinitely and *showcase* the system. WS-1
proved it no longer freezes *permanently*, but Max's live UAT (2026-07-01) caught it
**livelocking at the star** — pinned at the gravity-well barrier, cycling target
selections. A screensaver that gets stuck fails at the one thing a screensaver must
do. This work makes the tour route *intelligently* instead of aborting-and-skipping,
and (capstone) reconciles how the autopilot is framed against the HELM/ORRERY modes.

## Problem — the two-cause star livelock (corrected mechanics)

The map (5-agent subsystem read, 2026-07-01) corrected the working mental model:

- **speedCap does NOT throttle to zero from gravity.** It floors at `0.5 × R`
  (`CAP_MIN_FRAC`) inside `centerDist < 2.5 × R`. For a G-star (~4.65 scene-u radius)
  that floor is ~2.33 u/s. The ship *crawls*; it doesn't stop from the cap alone.
  (`SupercruiseModel.speedCap`, `src/flight/SupercruiseModel.js:85`.)
- **The literal "pinned, speed 0" state is a SEPARATE hard collision barrier** at
  `1.05 × R` (`COLLISION_FACTOR`). Cross it inward and the ship is projected back onto
  the `1.05R` sphere with `speed = 0`, every tick it stays inside.
  (`SupercruiseModel.update`, `:176`.)

Given that, "stuck at the sun" has **two distinct causes**:

1. **Star as the *target*.** The star is *always* stop #0 in every tour queue
   (`AutoNavigator.buildQueue`, `src/auto/AutoNavigator.js:36`), and the pilot parks
   *every* body at `2.6 × R` (`HOLD_VIEW_FRAC`, `SupercruisePilot.js:185`) — for a
   star that's deep inside the gravity well.
2. **Star as an *obstacle*.** On a leg to a planet on the *far side* of the star, the
   pilot aims dead-straight at the planet's center (`steerToward`, `:136`), so the
   path runs through the star's well; the ship crawls to the `1.05R` barrier and
   wedges. WS-1 aborts after 12s and the tour index advances — **but the ship is still
   pinned**, and the next far-side leg re-wedges. **This is the livelock Max saw.**

A bigger *park distance at the star* fixes cause #1 only. Cause #2 needs the tour to
**not route a leg through the star's keep-out zone** — either by going *around* it
(tour-layer) or by the pilot flying *out and around* the departing body (pilot-layer).

**Latent asset:** `populateQueueRefs` (`main.js:5664`) already computes a sane star
standoff `orbitDistance = min(8 × R, 0.6 × innerOrbit)` — but the supercruise pilot
**ignores it** (only the legacy NavigationSubsystem reads it). And the limb / "is the
target hidden behind a body" test already exists as `_isReticleOccluded`
(`main.js:436`). The building blocks are present.

## Guardrails (apply to every increment)

- **Never retune `SC_TUNING`** (`SupercruiseModel.js:10-38`) — `ETA_K`,
  `CAP_MIN_FRAC`, `COLLISION_FACTOR`, `FORCED_DROP_FLOOR_FACTOR`. Two prior live
  regressions. Every fix here is **routing**, never a physics-floor edit.
- **Never weaken the gravity well.** The livelock is *because* the well is strong near
  the star (by design). Fix by not going there / routing out — not by softening it.
- **Keep WS-1** as the backstop guard for all freeze modes. This work is **additive**.
- **The engine only translates along the nose** (`SupercruiseModel.update:170`) — no
  strafe/lateral velocity. Any "orbit" must be flown as a **curved pursuit arc** (aim
  the nose off-target at a tangent, let the curve carry the ship around the limb).

## Staged plan — four increments

| # | Increment | Layer | Risk | Delivers |
|---|-----------|-------|------|----------|
| 1 | Standoff + go-around routing | Tour (`main.js` dispatch + `AutoNavigator`) | Low (zero physics contact) | Kills the livelock reliably |
| 2 | Pilot orbit-to-horizon departure (reachability core) | Pilot (`SupercruisePilot`) | Medium (gravity-well crawl, WS-1 re-gate) | General "get away from any body"; covers Assist |
| 3 | Showcase policy layer | Pilot + policy | Low-Medium | The "chosen by the system" aesthetic swing |
| 4 | HELM/ORRERY reconciliation (in-ship vs god's-eye) | Host (`main.js` boot/mode) | Medium (evolves shipped mode UX) | Autopilot framed as a HELM feature; tour in cockpit |

Each increment gets its **own** `dev-collab-scope` contract → TDD → live verify →
`VERIFIED_PENDING_MAX` → Max UAT, before the next begins.

---

## Increment 1 — Standoff + go-around routing (the reliable livelock kill)

Tour-layer, zero physics-tuning contact. Ships first; dissolves what Max saw.

**1a — Stop parking in the well.** Thread a per-leg **hold/standoff distance** through
`ShipControls.flyTo` (`src/flight/ShipControls.js:111`) → `SupercruisePilot.beginLeg`
(`:78`), so the pilot honors a supplied approach distance instead of the hardcoded
`bodyRadius × HOLD_VIEW_FRAC`. For the star, feed the already-computed
`orbitDistance = min(8 × R, 0.6 × innerOrbit)` from `populateQueueRefs`
(`main.js:5664`). Non-star bodies keep today's `2.6R` unless they also need standoff.

**1b — Route around the star.** At the tour-advance dispatch (`_handleScPilotFrame`
advance block, `main.js:6876`, and `_beginTourLegMotion`, `:5740`), before dispatching
a leg, test whether the straight segment ship→next-target crosses the star's **keep-out
sphere** (reuse the `_isReticleOccluded` ray/sphere limb test, `main.js:436`; star
geometry from `_scBodies`, `:7838`). If it does, insert **one intermediate waypoint**
just outside the keep-out sphere (a step-aside/tangent point) and fly to it first, then
to the real target. The waypoint sits *outside* the keep-out sphere, so CRUISE to it
never enters the crawl/pin zone; from the waypoint the onward leg has clear line of
sight.

**Keep-out radius:** `max(k × R, just outside the 2.5 × R crawl-onset)`, with `k ≈ 3–4`.
Big enough to stay out of the pinning/crawl zone; tight enough that the star stays a
real presence you swing *past*, not a distant dot. **Not** the full escape-velocity
horizon (`forcedDropRadiusScene`, `proximityHorizon.js:27`) — that is huge for massive
stars and would make the tour give every star a wide berth.

**Star stays a tour stop**, viewed from the standoff as a proper establishing shot
(it's the system's visual centerpiece; the screensaver should show it off, just not
fly into it). Warp-arrival first-view seeding (`main.js:6019`) is preserved but now
resolves to the standoff-framed star.

**Why this is a clean first increment:** it fixes *both* causes at the tour layer with
no pilot surgery and no physics contact, so it's low-risk and shippable. 1b's geometry
(keep-out sphere + tangent) is the **foundation increment 2 reuses**, not throwaway.

---

## Increment 2 — Pilot orbit-to-horizon departure (reachability core)

Pilot-layer. Max's verbatim vision: *"orbiting the current body until the nose is
pointed over the horizon of the object and towards the next object."*

- **New `DEPART` phase** in `PilotPhase` (`SupercruisePilot.js:12`), entered from
  `beginLeg` (`:78`) *before* `ALIGN`. It flies a **curved pursuit arc** around the
  current (departing) body: aim the nose at a computed horizon-tangent rather than at
  the target, thrust, let the curve carry the ship around the limb, until the sightline
  to the next target **clears the body's horizon**, then fall through to `ALIGN`→
  `CRUISE`.
- **Which body am I departing?** The pilot doesn't track it today. Plumb it in:
  `_beginTourLegMotion(stop, priorBody)` (`main.js:5740`) already receives `priorBody`
  (preserved for exactly this per its docstring) but ignores it; forward it through
  `flyTo`→`beginLeg` as `{ fromBody, fromRadius }`. (Fallback: infer as the nearest
  entry in `this.model._bodies`.)
- **Horizon-clear predicate:** body angular half-width `α = asin(R / d)`; the sightline
  to `T` clears when `angle(P→T, P→C) > α`, equivalently the `P→T` segment no longer
  intersects the body's (inflated) sphere. All inputs exist at runtime: `P =
  scModel.position`, `C = body.mesh.position`, `R = body.data.radius`, `T =
  autoNav.getNextStop().bodyRef.position` (`AutoNavigator.js:125`), nose =
  `scModel.nose()`. Reuse `_isReticleOccluded` (`main.js:436`).
- **Reachability core:** arc amount emerges from geometry — near-zero when the next
  target is already clear, a full horizon-swing when the body/star blocks the line.
  This is the general "get away from any body" maneuver and it dissolves cause #2 *in
  the pilot*, so it **protects player Assist legs for free** (tour and Assist both
  route through the pilot).
- **General obstacle set:** the predicate should test the departing body **and the
  star** (the star-wedge is a star occlusion), i.e. all relevant bodies in
  `this.model._bodies` — not only the departing one.

---

## Increment 3 — Showcase policy layer ("chosen by the system")

On top of the reachability core, a small policy that may **also** choose a graceful
swing when it isn't strictly required — Max's "both departure styles viable, chosen by
the autopilot." A screensaver's job is to be nice to watch, so the ship sometimes does
a wider cinematic orbit around a striking body even when it could go straight.

- **Inputs the policy weighs:** body type/size (a big ringed planet warrants a swing;
  a tiny moon doesn't), time/legs since the last cinematic swing (variety without
  randomness), and never at the cost of reachability (safety always wins).
- **Built only after the reachability core is green**, so the aesthetic layer sits on a
  proven, always-justified base and can be tuned/disabled independently.
- Kept deliberately small and legible — the risk is a policy that feels *random*; the
  mitigation is few, explainable rules with a visible cadence.

---

## Increment 4 — HELM/ORRERY reconciliation (in-ship vs god's-eye) — CAPSTONE

Max's model: **HELM = "you're in the ship"** (fly it manually *or* hand off to the
autopilot, which flies while you watch from the cockpit/chase view). **ORRERY =
god's-eye examine** (click-select, commit-burn), player-driven. The autopilot tour
becomes an **in-cockpit** experience. This restructures tour rendering, camera, W/S
takeover, and HUD, so it lands **last**, once the intelligent tour is worth presenting
from the cockpit.

### ⚠️ This EVOLVES an approved, shipped design — confirm the reversal

The [2026-06-27 mode restructure](./2026-06-27-orrery-helm-mode-restructure-design.md)
(approved, implemented) made ORRERY/HELM **peer modes** and stated as an **explicit
non-goal**: *"No restriction of the autopilot tour (Q) in either mode"* — the tour was
**mode-agnostic**, rendered in ORRERY's god's-eye camera, and worked in both. Max's new
"in-ship vs god's-eye" model **reverses that**: the autopilot becomes a **HELM/in-ship
feature**, the tour renders in the cockpit, and ORRERY is purely player-driven. This is
a deliberate revision of prior approved behavior, not a fresh build. **Increment 4's
contract must open by confirming this reversal is intended** and reconciling the
peer-mode doc.

### The current (inverse) boot mapping to correct

Traced (`main.js`): the boot chooser maps **HELM→manual flight (autopilot OFF)**,
**ORRERY→autopilot tour screensaver**; `dismissTitleScreen` (`:2564`) unconditionally
sets `_autopilotEnabled = true`. The rewire is contained — `_pendingBootMode` has a
**single consumer** (`warpRevealSystem`, `:5983`), and `bootModeAction`
(`src/flight/flightModes.js:201`) is a pure reducer with 2 call sites + one test.

### Minimal delta (to be detailed at the increment-4 contract)

1. `bootModeAction`: carry `startAutopilot = (mode === 'helm')` instead of
   `enterFlight`.
2. `warpRevealSystem` (`:6029-6047`): HELM branch starts the autopilot (in the cockpit
   regime); ORRERY branch leaves the player in god's-eye with autopilot off and the
   tour *not* auto-armed.
3. Stop hard-setting `_autopilotEnabled = true` at `dismissTitleScreen:2564`; drive it
   from the boot pick.
4. **Move the tour's rendering into the HELM cockpit regime** (`_scManual = true` +
   `CameraMode.FLIGHT`) — the big part; today the tour assumes the ORRERY regime (tour
   glue, W/S takeover `:9293-9303`, camera, HUD).
5. **Mobile default** (`_isMobile` coercion `:2554`, `!_isMobile` gate `:6031`): today
   mobile is ORRERY-only and gets the tour. After the flip, "ORRERY = player-driven"
   would strand mobile with no autopilot default — decide whether mobile now coerces to
   the autopilot (HELM/tour) outcome. **Open decision.**
6. Update `bootMode.test.js`, boot-flow comments, chooser/HUD/Options copy, and the
   2026-06-27 spec's non-goal.

### Open design question for increment 4

Moving the tour into the cockpit changes the *character* of the screensaver (cockpit /
chase view of the ship flying itself, vs today's contemplative god's-eye). Confirm that
is the intended screensaver feel, and decide whether ORRERY (god's-eye) still has an
idle-screensaver fallback at all.

---

## Cross-cutting

**WS-1 interaction (increments 2–3).** The CRUISE stall-detector
(`SupercruisePilot.js:150-176`) keys on CRUISE only — good — but the `DEPART` orbit
makes *zero toward-target progress by design* and would false-trip a naive guard.
`DEPART` gets **its own timeout** (mirror `ALIGN_TIMEOUT` ~8s, or scale to body size);
on timeout, fall through to `ALIGN` (don't abort the whole leg unless truly stuck).
Net: an intentional orbit can't false-abort, and a stuck departure still can't freeze.

**Feasibility risk — gravity-well crawl (increment 2).** Departing from a deep hold,
`speedCap` throttles the tangential arc; the ship may crawl while swinging out.
Mitigation: **back off radially to the standoff first** (which increment 1 already
establishes), *then* arc. If crawl persists, revisit the routing/arc shape — **never**
weaken `SC_TUNING`.

**Float32 / rebasing.** World-origin rebasing (`src/core/WorldOrigin.js:136`) keeps
`P` and all body centers within ~100 scene units of origin, so relative geometry
(`P−C`, `asin(R/d)`) is float32-precise. New geometry must read live `.mesh.position`
each tick (the pilot already does, `:106`) and must **not** cache absolute positions
across a rebase without registering via `trackForRebase`. Bodies orbit each tick, so
`C` and `T` drift during a maneuver — re-evaluate the clearance gate **per tick**, not
once.

**Units.** 1 AU = 1000 scene units (`ScaleConstants.js:39`); radii are tiny
(G-star ≈ 4.65 u, Earth ≈ 0.043 u) vs huge orbits, so `R/d` is small and `asin(R/d)`
is well-conditioned — but floor near-zero-radius bodies to avoid degeneracy.

## Testing strategy

- **Unit (headless vitest, TDD):** the pure geometry — keep-out radius, horizon-clear
  predicate, tangent-waypoint placement, the `DEPART` phase transitions and its
  timeout — on fresh `SupercruiseModel` / `SupercruisePilot` instances (mirror
  `src/flight/__tests__/SupercruisePilot.align.test.js` + `SupercruiseStall.test.js`).
  Run with `./node_modules/.bin/vitest run <path>` (`npx vitest`/`npx vite` are
  hook-blocked; avoid "vite" in commit messages).
- **Reliability suite:** extend `runFlightReliabilitySuite` (`window.__wd`) with a
  forced **far-side-star** scenario. Increment 1: the leg must *complete without a
  stall-abort*. Increment 2: it must complete *without wedging at all*.
- **Integration (live, chrome-devtools on `:5173`):** working-Claude drives objective
  checks — force a far-side-star tour leg, confirm the ship routes around / arcs out
  and reaches the next body; confirm no barrier-pin. Keep the tab foreground
  (`select_page bringToFront`) to avoid rAF-throttle false freezes.
- **Build gate:** `npm run build` clean.
- **UAT (Max only):** the tour runs reliably unattended *and still showcases the
  system*; the departure reads as intelligent, not stuck; (inc 4) the mode framing
  reads right. No agent closes UAT.

## Non-goals

- No `SC_TUNING` retune; no weakening the gravity well.
- No model-layer hard standoff barrier (would relocate the wedge outward and affect the
  player in manual flight; routing solves it without physics contact).
- No fast-moon *capture* (still a separate possible WS-4).
- No removal of WS-1 (it stays as the backstop).
- Increment 4 does **not** silently override the 2026-06-27 peer-mode design — it
  reconciles it explicitly.

## Key code anchors

| Symbol | File:line | Role |
|--------|-----------|------|
| `PilotPhase` / `beginLeg` / `update` | `src/flight/SupercruisePilot.js:12` / `:78` / `:96` | Phase machine; add `DEPART`, accept `fromBody`, honor per-leg standoff |
| CRUISE stall-detector | `SupercruisePilot.js:150-176` | WS-1 guard; must not false-trip `DEPART` |
| `HOLD_VIEW_FRAC` capture (2.6R) | `SupercruisePilot.js:185` | Replace with per-leg standoff distance |
| `speedCap` / `_bodies` / `setBodies` | `src/flight/SupercruiseModel.js:85` / `:49` / `:58` | Well cap; full body list reachable via `model._bodies` |
| collision barrier (1.05R) | `SupercruiseModel.js:176` | The literal pin state |
| `forcedDropRadiusScene` / `starMassKgFromSceneRadius` | `src/flight/proximityHorizon.js:27` / `:19` | Escape-horizon math (reference, not the keep-out) |
| `steerToward` / `alignDot` | `src/flight/aimAssist.js:40` / `:27` | Nose-steer + clearance primitives |
| `flyTo` | `src/flight/ShipControls.js:111` | Single leg funnel; widen to carry standoff + fromBody |
| `_isReticleOccluded` | `src/main.js:436` | Existing ray/sphere limb test — reuse for keep-out crossing |
| `populateQueueRefs` (dead `orbitDistance`) | `main.js:5655` / `:5664` | Sane star standoff, currently ignored by the pilot |
| `_handleScPilotFrame` / advance | `main.js:6831` / `:6876` | Tour advance; waypoint insertion + fromBody plumbing |
| `_beginTourLegMotion` (`priorBody`) | `main.js:5740` | Already carries the departing body; forward it |
| `_scBodies` build / `setBodies` | `main.js:7838` | Per-tick body list (star massKg included) |
| `AutoNavigator.buildQueue` / `getNextStop` / `advanceToNextWithBody` | `src/auto/AutoNavigator.js:32` / `:125` / `:162` | Queue; star is stop #0; next-target ref |
| `bootModeAction` / `warpRevealSystem` / `_pendingBootMode` | `src/flight/flightModes.js:201` / `main.js:5983` / `:2543` | Inc 4 boot rewire (single consumer) |

## Cross-references

- Program plan: [`docs/FLIGHT_RELIABILITY_PROGRAM_2026-06-30.md`](../../FLIGHT_RELIABILITY_PROGRAM_2026-06-30.md)
- WS-1 contract: [`docs/WORKSTREAMS/cruise-stall-detector-2026-07-01/`](../../WORKSTREAMS/cruise-stall-detector-2026-07-01/)
  (the residual livelock this solves)
- Mode design this evolves: [`2026-06-27-orrery-helm-mode-restructure-design.md`](./2026-06-27-orrery-helm-mode-restructure-design.md)
- Arrival-modes arc: [`2026-06-27-supercruise-arrival-modes-design.md`](./2026-06-27-supercruise-arrival-modes-design.md)
