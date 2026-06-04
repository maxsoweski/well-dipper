---
Scope:
  base: master
  paths: ["src/main.js", "src/core/WorldOrigin.js", "tests/orbit-ring-rebase.test.js"]
  features: ["world-origin-rebasing"]
  systems: ["world-origin"]
---

# Workstream: world-origin-reset-on-system-swap-2026-06-04

## Status

**SCOPED — awaiting GATE 1 (Max brief review).**

Origin: architecture review (2026-06-04) following the
`world-origin spawn-once-body centering` ship (`2d607de`). That ship
fixed five spawn-once displacement sites by hand
(`tests/orbit-ring-rebase.test.js` + the five `placeInRebasedFrame`
calls). This workstream addresses the *structural cause* of that bug
class rather than the next symptom: the system-swap reset that was
designed-in but never wired.

## Parent feature

`docs/FEATURES.md` row 178 (World-origin rebasing) + §"World-origin
rebasing — pipeline crossing". `SYSTEMS.md` `world-origin` row +
"`world-origin` is a pipeline-crosser" cross-cutting note. No dedicated
`SYSTEMS/world-origin/` doc exists yet (JOURNEY §"Doc system completion"
flags `SYSTEMS/world-origin/ROADMAP.md` as authored-on-first-deep-dive,
trigger = "before any Layer-3 ship-scale features begin"). This
workstream is a candidate trigger for that doc; see §Out of scope.

## Maps to journey

Serves the **35% SCREENSAVER-MVP** milestone defensively (warp-reached
systems must render with centered bodies — already true after `2d607de`,
this hardens it against the next missing call) AND the **world-origin
rebasing arc** that JOURNEY names as the architectural prerequisite for
the **85% GAME layer** (ship-scale precision; `PLAN_world-origin-rebasing.md`
is listed at JOURNEY 60% as the blocking dependency for Layer-3
close-approach work). PLAYER_EXPERIENCE tier: this is Infrastructure —
no new player-visible feature; the visible criterion is the *absence* of
displacement defects in warp-reached systems.

## Why we care

The spawn-once displacement bug has been fixed twice now by hand —
`rebase-celestial-frame-fix-2026-05-03` (per-frame producers) and
`world-origin spawn-once-body centering` (`2d607de`, five spawn-once
sites). Both were whack-a-mole on a symptom. The structural finding:
`resetWorldOrigin()` is imported at `src/main.js:61` and **never called
anywhere** — its own docstring says "For use at system swap (warp
arrival)." It was designed to be wired into `spawnSystem` and never was.

Because `worldOrigin` carries a nonzero value into every warp-reached
system, spawn coords ≠ true coords on arrival, so EVERY spawn-once object
is a latent displacement bug until someone remembers `placeInRebasedFrame`.
The invariant "seed spawn-once objects at −worldOrigin" is implicit,
undocumented as a rule, and unenforced — no test, lint, or assert catches
the next missing call. The next person adding a spawn-once scene object
(a ring band, a station marker, a megastructure anchor — exactly the
Layer-2/Layer-3 work JOURNEY queues) re-introduces the bug and finds out
in a warp-reached system, not at the desk.

The felt motivation: stop fixing this bug one site at a time, and convert
the implicit invariant into either a structural impossibility (reset →
`worldOrigin` is 0 at spawn → spawn coords == true coords, no seeding
needed) or an enforced one (a regression test that fails the moment a
spawn-once object is left displaced). The durable value is the second
half — the bug becomes catchable at the test layer instead of in Max's
browser three warps deep.

## Current objective + success criteria

**What we're changing:** Wire the dead `resetWorldOrigin()` into
`spawnSystem`'s reset block so `worldOrigin` ≈ 0 at the moment spawn-once
objects are placed; and add a regression test that asserts the spawn-once
seeding invariant holds across a simulated warp. Before either, confirm
at runtime the hand-traced self-neutralization claim (below) — the brief
treats this as the gating early step because the approach changes if the
trace is wrong.

**Precondition trace to confirm first (NOT yet runtime-verified).**
The architecture review hand-traced that `worldOrigin` self-neutralizes
each warp: `warpSwapSystem` (`src/main.js:5173`) positions the camera
relative to `star.mesh.position` (which after spawn == `−worldOrigin`,
line `5229`: `camera.position.set(starPos.x, starPos.y + 2, starPos.z +
...)`). On the first post-arrival frame the rebase offset (≈ `−worldOrigin`)
cancels the carried value and pulls `worldOrigin` back near zero — so it
does NOT grow unbounded across warps (the initially-suspected precision
time-bomb turned out wrong). This self-healing is why the system mostly
works despite the dead reset. **This trace must be confirmed live before
the fix is designed**, because if it's wrong (e.g., `worldOrigin` does
accumulate, or the cancellation is partial), wiring a bare
`resetWorldOrigin()` may leave the scene graph and `worldOrigin` in
disagreement and the approach must additionally handle the carried value
explicitly. The live confirmation surface exists:
`window.__diag._rebaseEvents` (bounded ring buffer at `src/main.js:7327`)
records `worldOrigin: [x,y,z]` per rebase event.

The success criteria (Max's stated AC set, refined to observable shape):

- **AC #1 — Precondition confirmed live (gating).** Across a sequence of
  ≥3 autopilot warps, `worldOrigin` magnitude does NOT grow monotonically
  warp-over-warp — it returns near zero shortly after each arrival
  (confirming the self-neutralization trace). Observable: the
  `window.__diag._rebaseEvents` `worldOrigin` magnitudes sampled at
  start-of-system vs. settled-in-system show the per-arrival value
  collapsing toward 0, not stacking. *If AC #1 fails (value accumulates),
  STOP and return to PM — the fix scope changes.*
  - **Tester verifies via** chrome-devtools (GPU Chrome port 9223; see
    `~/.claude/projects/-home-ax/memory/well-dipper-testing-reference.md`):
    enter via `window._lab.enterSol()`, trigger ≥3 warps, read
    `window.__diag._rebaseEvents` + `WorldOrigin._debugState().worldOrigin`
    at each arrival and after settle. Assert no monotonic growth.

- **AC #2 — `resetWorldOrigin()` runs on every system swap such that
  `worldOrigin` ≈ 0 at the moment spawn-once objects are placed.**
  Observable: at the `placeInRebasedFrame` call sites during
  `spawnSystem`, `worldOrigin.lengthSq()` reads ≈ 0; the five seed calls
  become defensive no-ops (they negate a zero vector).
  - **Tester verifies via** a unit assertion (below) AND live: instrument
    or log `WorldOrigin._debugState().worldOrigin` at the top of
    `spawnSystem` after the reset, across warp-reached spawns — confirm ≈ 0.

- **AC #3 — No visible displacement of stars / orbit rings / asteroid
  belts in warp-reached systems, single AND binary.** Max would SEE:
  the single star sits at the center its planets orbit (coplanar, not
  "above the plane"); planet orbit rings are concentric on the star /
  barycenter; the asteroid belt encircles the barycenter; binary orbit
  lines encircle the binary pair. Same as the `2d607de` ship's verified
  state — this AC confirms the reset preserves it, not regresses it.
  - **Tester verifies via** chrome-devtools (GPU 9223) + the inspection
    layer: `window.__wd.takeSceneInventory()` and the `2d607de`
    predicates — single-star `|planet−star| == orbitRadiusScene` (0%
    error) + coplanarity; ring centers coincident with star/barycenter
    at exact radii. Run for one single-star AND one binary warp-reached
    system.

- **AC #4 — No interpolation jump / camera glitch on warp arrival.**
  Max would SEE: the warp EXIT → reveal transition is as smooth as it is
  today; no single-frame snap of the camera or bodies at the swap.
  *(Risk surface: a manual `resetWorldOrigin()` zeroes `worldOrigin` but
  does NOT fire `onRebase` listeners — see Blast radius.)*
  - **Tester verifies via** chrome-devtools recording of the warp-arrival
    window + the interpolation-snapshot listener path (`src/main.js:7311`):
    confirm `_prevCamPos`/`_currCamPos`/interp meshes do not carry a stale
    offset across the swap. Frame-timing primitive (per
    `inspection-layer-v2 Phase B`) on the arrival window if a snap is
    suspected.

- **AC #5 — Autopilot, nav, and camera-choreographer behavior unchanged
  across a warp (no cached-vector drift).** Max would SEE: the post-warp
  autopilot establishing tour behaves as today — no camera lurch, no
  "giant fake velocity" event, no look-at target snapping to a stale
  point.
  - **Tester verifies via** chrome-devtools live autopilot tour through a
    warp + the motion-test-kit `approachPhaseInvariant` predicate on a
    fresh dogfood capture that crosses the swap (the same predicate that
    gated `rebase-celestial-frame-fix-2026-05-03`). 0 rebase-band
    violations attributable to the swap.

- **AC #6 — Regression test enforces the spawn-once seeding invariant
  across a simulated warp (the durable deliverable).** Extends
  `tests/orbit-ring-rebase.test.js`. The test asserts the invariant that
  would catch the NEXT missing `placeInRebasedFrame` / missing reset:
  after a simulated system swap (warp-accumulate `worldOrigin` to a large
  value, then run the reset), a spawn-once object placed with the
  production seeding helper sits at the barycenter, AND a characterization
  test pins that an UN-reset, UN-seeded object is displaced — so the test
  fails loudly if the reset is removed.
  - **Tester verifies via** `npm test` — the new test(s) PASS at HEAD,
    and (working-Claude demonstrates) FAIL when the `resetWorldOrigin()`
    call is reverted (red-bar proof the test guards the invariant).

## Architectural connections

### Inputs (what this change consumes)
- **`src/core/WorldOrigin.js` API** — `resetWorldOrigin()` (the dead
  export being wired), `worldOrigin` (the running offset vector),
  `placeInRebasedFrame` (the five seed calls that become no-ops),
  `maybeRebase` (the per-frame fold), `onRebase`/`_listeners` (NOT fired
  by a manual reset — central to the blast radius), `_debugState()`
  (telemetry read for AC #1/#2).
- **`spawnSystem` reset block** (`src/main.js:3434–3453`, the
  "── Reset state ──" section) — the insertion point for the reset call.
- **`warpSwapSystem`** (`src/main.js:5173`, camera-relative-to-star at
  `5229`) — the camera-teleport whose `star.mesh.position` read is what
  the self-neutralization trace depends on.
- **`window.__diag._rebaseEvents`** (`src/main.js:7327`) — the live
  rebase telemetry the AC #1 precondition trace reads.

### Outputs (what depends on this change)
- **The five `placeInRebasedFrame` call sites** (single star
  `main.js:3567`, binary orbit lines `3594`/`3598`, planet orbit ring
  `3737`, asteroid belt `3778`) — become defensive no-ops once
  `worldOrigin` is 0 at spawn. Decision: keep-as-defensive vs. remove
  (see Out of scope — recommendation is KEEP).
- **Interpolation-snapshot coherence** (`_onWorldRebase` listener,
  `src/main.js:7311`) — subtracts the rebase offset from
  `_prevCamPos`/`_currCamPos`/interp meshes. A manual reset does NOT
  fire this listener; anything holding rebased state across the swap
  could glitch (AC #4).
- **Tracked controller caches** (`_trackControllerCaches`,
  `src/main.js:507–556`) — autopilotMotion / navSubsystem /
  cameraChoreographer (+ `._establishing`) / cameraController
  (+ `._diagnostics`) / shipChoreographer cached Vector3s registered via
  `trackForRebase`. These get `.sub(offset)` on a *rebase* but NOT on a
  manual *reset* (AC #5).
- **Tester's verification path + Max's UAT** — the inspection-layer
  predicates and live autopilot tour consume the post-reset scene state.
- **Future Layer-2/Layer-3 spawn-once authors** — the regression test
  (AC #6) is the contract they inherit; the reset is the structural
  guarantee that lets them omit manual seeding.

### Features that must stay working (regression-prevention map)
- **Warp flow** (FOLD/HYPER/EXIT → swap → reveal): bodies centered on
  arrival, smooth transition, no snap.
- **Autopilot establishing tour** post-warp: no cached-vector drift,
  no fake-velocity event.
- **Binary systems**: binary orbit lines + both stars centered on the
  barycenter (the `2d607de` ship verified binaries unaffected; this must
  hold).
- **In-system flight**: `maybeRebase` continues to fire and self-correct
  as the camera roams; the reset must not interfere with the normal
  per-frame rebase loop.
- **Deep-sky arrivals** (`warpRevealSystem`, `src/main.js:5247–5256`):
  uses a DIFFERENT convention — snaps the deep-sky destination to scene
  `(0,0,0)` and places the camera at absolute scene coords, IGNORING
  `worldOrigin`. A reset interacts with this path; it must not displace
  deep-sky destinations or break the contemplation-coast camera. (See
  Blast radius + Open questions.)
- **Title-screen spawn** (`spawnSystem({ systemData: titleData })`,
  `src/main.js:3345`): this is a `forWarp: false` spawn at session start
  when `worldOrigin` is already ≈ 0 — a reset here is a no-op, but the
  path must be confirmed unaffected.

## Blast radius (Rule 7 — dep graph consulted: `docs/SYSTEMS.md` `world-origin` row, regenerated via `npm run doc-graph`)

Things that assume current behavior. The defining hazard: **a manual
`resetWorldOrigin()` zeroes the vector but does NOT fire `onRebase`
listeners**, so any state shifted by the listener path on a normal rebase
is NOT shifted by a manual reset.

1. **Interpolation snapshots** (`_onWorldRebase` at `src/main.js:7311`).
   The listener subtracts the offset from `_prevCamPos`/`_currCamPos`/
   interp meshes. On a manual reset these are NOT touched. **Mitigant
   already in place:** the camera is hard-teleported in `warpSwapSystem`
   (`5229`), so interpolation across the swap may already be discontinuous-
   by-design and hidden by the warp visuals. **Must be checked at AC #4** —
   if the reset introduces a *new* discontinuity the warp doesn't hide,
   the fix must also reset/clear the interpolation snapshots at swap (they
   should already be re-seeded by the post-swap camera teleport — confirm).

2. **Tracked controller caches** (`_trackControllerCaches`,
   `src/main.js:507`). `autopilotMotion`, `navSubsystem`,
   `cameraChoreographer(+._establishing)`, `cameraController(+._diagnostics)`,
   `shipChoreographer` register cached Vector3s for `.sub(offset)` on
   rebase. A manual reset does NOT shift them. **Why low-risk:** these
   caches hold IN-SYSTEM positions; at warp swap the new system rebuilds
   autopilot/nav state (`warpRevealSystem` restarts the tour) so most
   caches are re-initialized after arrival regardless. **Hazard:** any
   cache READ between the reset and the cache's re-initialization would
   read a stale value relative to a now-zeroed `worldOrigin`. **Guard:**
   AC #5 (autopilot/nav/choreographer behavior unchanged) + the
   `approachPhaseInvariant` predicate; working-Claude confirms the swap
   re-initializes these caches before any read.

3. **Camera-relative-to-star math** (`warpSwapSystem:5229`,
   `camera.position.set(starPos.x, ...)`). The camera is positioned
   relative to `star.mesh.position`. Today, after spawn, `star.mesh.position
   == −worldOrigin`. After the reset + `placeInRebasedFrame` no-op,
   `star.mesh.position == 0`. The camera-target geometry MUST be identical
   under both (the star is the same rendered point). **This is the trace's
   linchpin** — confirm the camera lands the same world-relative distance
   from the star whether the star is seeded at `−worldOrigin` (today) or at
   `0` (post-reset). AC #1 + AC #3 + AC #4 jointly cover this.

4. **The five `placeInRebasedFrame` call sites** (single star `3567`,
   binary lines `3594`/`3598`, planet ring `3737`, belt `3778`). Become
   no-ops. **Decision required:** keep as defensive (recommended — they
   cost one negate of a zero vector and protect against the reset ever
   being moved/removed) or remove (couples correctness solely to the reset
   being present). Recommendation: **KEEP**, and let AC #6's
   characterization test be the second line of defense.

5. **Deep-sky path divergence** (`warpRevealSystem`, `src/main.js:5247`,
   esp. `5256` `system.destination.mesh.position.set(0,0,0)`). Deep-sky
   uses a different convention: snaps the destination to scene origin and
   places the camera at absolute scene coords, IGNORING `worldOrigin`.
   A reset zeroes `worldOrigin` right before this path runs (deep-sky
   arrivals also go through `spawnSystem`). **Hazard:** if any deep-sky
   placement relied on `worldOrigin` being nonzero (it appears NOT to —
   the path explicitly ignores it), the reset is harmless; but the
   interaction must be confirmed, not assumed. **Guard:** AC checklist
   must include one deep-sky external-galaxy warp (the surviving KEEP path
   per `deep-sky-cleanup-2026-05-29`) — confirm no displacement of the
   deep-sky destination and no camera-coast regression. (See Open
   questions: deep-sky may warrant its own follow-up if the reset proves
   to need path-specific handling.)

## Test Coverage Plan

Cites the project's testing surfaces (no `docs/TESTING_CONVENTIONS.md`
exists; the canonical mechanisms are: vitest at `tests/*.test.js`;
chrome-devtools on GPU Chrome port 9223 per
`well-dipper-testing-reference.md`; the inspection layer `window.__wd.*`
predicates; the motion-test-kit `approachPhaseInvariant`; rebase
telemetry `window.__diag._rebaseEvents`). UAT IS relevant — this is a
visible-behavior project and the failure mode is visible displacement.
Per the "UAT presupposes integration GREEN" rule, AC #3/#4/#5 UAT items
are gated on the live chrome-devtools integration checks passing first.

| AC | Unit coverage | Integration coverage | UAT coverage |
|---|---|---|---|
| AC #1 (precondition trace) | N/A — runtime-only behavior across real warps | chrome-devtools GPU 9223: ≥3 warps, read `__diag._rebaseEvents` + `_debugState().worldOrigin`; assert no monotonic growth | N/A — engineering precondition, not a felt-experience item |
| AC #2 (reset runs, worldOrigin≈0 at spawn) | `tests/orbit-ring-rebase.test.js` extension: simulate swap (warp-accumulate then `resetWorldOrigin()`), assert `worldOrigin.lengthSq()` ≈ 0 at the seed point | chrome-devtools: log `_debugState().worldOrigin` at `spawnSystem` top after reset across warp-reached spawns; ≈ 0 | N/A — internal invariant |
| AC #3 (no visible displacement) | covered at AC #6 (geometric invariant in vitest) | chrome-devtools GPU 9223 + `__wd.takeSceneInventory()`: single-star `\|planet−star\|==orbitRadiusScene` 0% err + coplanar; ring/belt centered; one single + one binary warp-reached system | Max-eyes in real browser: warp into a system, confirm star centered / rings concentric / belt encircling — single AND binary |
| AC #4 (no interp/camera glitch) | N/A — frame-timing behavior, not unit-testable in isolation | chrome-devtools recording of arrival window + frame-timing primitive (inspection-layer Phase B); interp-snapshot path inspected for stale offset | Max-eyes: warp arrival reads as smooth as today, no snap |
| AC #5 (autopilot/nav/camera unchanged) | N/A — integration-scope motion behavior | motion-test-kit `approachPhaseInvariant` on fresh dogfood capture crossing the swap; 0 rebase-band violations attributable to swap | Max-eyes: post-warp establishing tour behaves as today |
| AC #6 (regression test — durable deliverable) | `tests/orbit-ring-rebase.test.js`: new `describe` for swap-reset invariant — seeded object at barycenter post-reset + characterization that an un-reset/un-seeded object is displaced; working-Claude demonstrates RED when the reset call is reverted | N/A — the unit test IS the enforcement layer | N/A — test infrastructure |

## Implementation pointers

Read first, in order:
1. `src/core/WorldOrigin.js` — the full API. Note `resetWorldOrigin()`
   "does NOT touch scene children — the caller is responsible for placing
   objects in the new frame" and does NOT fire `onRebase`.
2. `tests/orbit-ring-rebase.test.js` — the existing coverage to extend;
   it already uses `resetWorldOrigin()` in `beforeEach` and has the
   `warpAccumulate` / `barycenterRenderPos` helpers AC #6 will reuse.
3. `src/main.js:3434–3453` (spawnSystem reset block — insertion point),
   `5173`/`5229` (warpSwapSystem camera-relative-to-star),
   `5247–5256` (warpRevealSystem deep-sky path),
   `7311` (interp-snapshot listener), `507–556` (tracked caches),
   `7327` (rebase telemetry), `3567`/`3594`/`3598`/`3737`/`3778`
   (the five seed sites).
4. `docs/WORKSTREAMS/rebase-celestial-frame-fix-2026-05-03.md` +
   `docs/WORKSTREAMS/world-origin-rebasing-2026-05-01.md` — prior
   rebasing precedent (drift-risk framing, Principle 2 / 6 application).
5. `~/.claude/projects/-home-ax/memory/well-dipper-testing-reference.md`
   + `well-dipper-rebasing-plan.md` — how to test; the broader rebasing
   architecture (note: that plan suspected unbounded precision growth;
   AC #1 confirms the self-neutralization that makes it bounded).

Implementation choice left to working-Claude: exact placement of the
reset call within the reset block (after the warpTarget clears, before
the spawn-once placement; must run for BOTH `forWarp: true` and
`forWarp: false` spawns so title-screen and debug spawns also start
clean). Do NOT pre-architect a listener-firing variant of
`resetWorldOrigin()` unless AC #4 proves a glitch the warp doesn't hide —
that would be a `WorldOrigin.js` API change (see Out of scope).

## In scope

- Confirm the self-neutralization trace live (AC #1) — gating first step.
- Wire `resetWorldOrigin()` into the `spawnSystem` reset block (AC #2).
- Keep the five `placeInRebasedFrame` calls as defensive no-ops (AC #4
  decision: KEEP).
- Extend `tests/orbit-ring-rebase.test.js` with the swap-reset invariant
  + characterization, demonstrate RED-on-revert (AC #6).
- Live verification of single + binary + one deep-sky warp (AC #3/#4/#5).

## Out of scope

- **Any API change to `src/core/WorldOrigin.js`** — including making
  `resetWorldOrigin()` fire `onRebase` listeners — UNLESS AC #4 proves a
  glitch the warp doesn't hide. If it does, that becomes its own scoped
  decision (it widens the blast radius to every listener) — surface to
  Max, do not author inline.
- **Removing the five `placeInRebasedFrame` calls** — recommendation is
  KEEP as defensive; removal couples correctness solely to the reset.
- **Any change to `REBASE_THRESHOLD_SQ`** — tuning fire frequency does not
  address the bug class (per the `rebase-celestial-frame-fix` precedent).
- **Deep-sky-specific reset handling** — IF AC's deep-sky check reveals the
  reset needs path-specific handling, that is a follow-up workstream, not
  a scope expansion here. Note it; don't build it.
- **Authoring `SYSTEMS/world-origin/ROADMAP.md` or a dedicated feature
  doc** — JOURNEY flags this as deep-dive-triggered doc-altitude work; a
  thin doc bootstrapped under fix pressure doesn't pay back. Flag at
  workstream close as a parking-lot item (this workstream is plausibly the
  trigger Max chooses for that deep dive).
- **The world-origin rebasing precision rebasing plan**
  (`PLAN_world-origin-rebasing.md`, the broader ship-scale architecture).
  This workstream confirms a premise of that plan (bounded `worldOrigin`)
  but does not execute it.

## Drift risks

- **Risk — AC #1 skipped or treated as a formality.** Working-Claude wires
  the reset, the visible bodies look fine (they already were after
  `2d607de`), ships without confirming the trace. If the trace was wrong
  (worldOrigin actually accumulates), a bare reset leaves `worldOrigin`
  and the scene graph in disagreement under some warp sequence and the bug
  resurfaces in a way the spot-check missed.
  **Guard:** AC #1 is GATING — read `__diag._rebaseEvents` across ≥3 warps
  BEFORE finalizing the fix; if the value accumulates, STOP and return to
  PM (the fix scope changes to also handle the carried value).

- **Risk — `onRebase`-listener gap ships a latent glitch.** A manual reset
  doesn't fire listeners; an interp-snapshot or a controller cache holds a
  stale offset across the swap, producing a one-frame snap or a fake
  velocity event that the warp visuals mostly-but-not-always hide.
  **Guard:** AC #4 (frame-timing on the arrival window) + AC #5
  (`approachPhaseInvariant`). Working-Claude confirms the post-swap camera
  teleport re-seeds the interp snapshots and the swap re-initializes the
  tracked caches before any read.

- **Risk — deep-sky path silently regresses.** Deep-sky uses the absolute-
  scene-coord convention and ignores `worldOrigin`; a reviewer focused on
  star-systems forgets to exercise a deep-sky warp.
  **Guard:** AC checklist explicitly includes one external-galaxy
  (deep-sky) warp; confirm no destination displacement, no coast regression.

- **Risk — regression test passes trivially (never crosses threshold).**
  AC #6's test asserts "object at barycenter" but if the test scenario
  never grows `worldOrigin` before the reset, the reset is a no-op and the
  test guards nothing.
  **Guard:** the test MUST warp-accumulate `worldOrigin` to a large value
  (reuse `warpAccumulate3` with a nonzero Y) BEFORE the reset, and the
  characterization half MUST show the un-reset/un-seeded object displaced
  by the accumulated magnitude (mirrors the existing characterization
  tests at `orbit-ring-rebase.test.js:120` and `:188`). Working-Claude
  demonstrates RED-on-revert as proof.

- **Risk — economy-first reflex: "the bodies already look fine after
  `2d607de`, why touch it."** The visible symptom is already fixed; the
  temptation is to skip the structural fix.
  **Guard:** the feature being built is the *enforced invariant*, not the
  visible centering. AC #6 (the regression test) is the load-bearing
  deliverable — it is what stops the next spawn-once author from
  re-introducing the bug. Skipping it because "it looks fine" is exactly
  the whack-a-mole this workstream exists to end.

## Principles that apply

From the legacy `GAME_BIBLE` §"Development Philosophy" (still the
project's philosophy source per `rebase-celestial-frame-fix-2026-05-03`
precedent) — the load-bearing pair:

- **Principle 6 — First Principles Over Patches.** *Load-bearing.* The
  spawn-once displacement bug has now been patched twice at the symptom
  (per-frame producers; spawn-once seed sites). The first-principles read:
  rebasing is a coordinate-frame transform with a designed-in reset at
  discontinuities (`resetWorldOrigin` "for use at system swap"); the bug
  exists because the reset was never wired. The principled fix is to wire
  the reset (so spawn coords == true coords structurally) and enforce the
  invariant with a test — not to add a third manual-seeding site the next
  time a spawn-once object appears. Violation looks like: shipping the
  reset without the regression test (AC #6), or "fixing" by adding more
  `placeInRebasedFrame` calls instead.

- **Principle 2 — No Tack-On Systems.** *Load-bearing.* The fix lives at
  the right layer — a single call to an EXISTING, designed-for-this-purpose
  function at the swap boundary. Violation looks like: inventing a new
  `resetWorldOriginAndNotify()` wrapper, or a `spawnSystem`-side
  coordinate-translation helper, or any change to `WorldOrigin.js` beyond
  calling its existing API — unless AC #4 forces the listener-firing
  question, which is then a scoped decision, not an inline tack-on.

(Principles 1, 3, 4, 5 not at risk: hash grid untouched; retro aesthetic
untouched; BPM sync untouched; the model→pipeline→renderer direction is
preserved — the reset is a renderer-frame operation at a discontinuity,
not a model-side write.)

Advances the **Scale System / precision ceiling** (legacy §"Scale System"):
the rebasing system's promise — float32 precision regardless of camera
drift — depends on `worldOrigin` staying bounded; AC #1 confirms it does,
and the reset makes the bound explicit at the one discontinuity (system
swap) where continuous-motion rebasing doesn't apply.

## Handoff to working-Claude

Read `src/core/WorldOrigin.js`, `tests/orbit-ring-rebase.test.js`, and the
five `spawnSystem`/`warpSwapSystem` sites first; treat the
§"Architectural connections" map as the working integration map and the
§"Blast radius" as the regression checklist. The FIRST step is AC #1 —
confirm the self-neutralization trace live via `window.__diag._rebaseEvents`
across ≥3 warps; if `worldOrigin` accumulates instead of collapsing toward
zero, STOP and return to PM, because the fix scope changes. Avoid any
`WorldOrigin.js` API change (especially making the reset fire listeners)
unless AC #4 proves a glitch the warp doesn't hide — that is a scoped
decision for Max, not an inline edit. The load-bearing deliverable is AC #6
(the regression test that converts the implicit "seed spawn-once objects"
invariant into an enforced one); demonstrate it RED-on-revert. "Done" looks
like: trace confirmed, one-line reset wired into the `spawnSystem` reset
block, the five seed calls kept as defensive no-ops, the regression test
extended + proven RED-on-revert, and live confirmation across single +
binary + one deep-sky warp that bodies stay centered with no
interp/camera/autopilot glitch — then Tester PASS, then Max GATE 3 UAT in
real Chrome (port 9223). Invoke Tester after the fix + test land:
`Agent(subagent_type="tester", model="opus")` with this brief path + the
diff.

## Cross-references

- `docs/WORKSTREAMS/world-origin-rebasing-2026-05-01.md` — the rebasing
  workstream that introduced `resetWorldOrigin` and didn't wire it.
- `docs/WORKSTREAMS/rebase-celestial-frame-fix-2026-05-03.md` — prior
  symptom fix (per-frame producers); drift-risk + principle framing reused.
- `2d607de` "seed spawn-once bodies into the rebased frame" — the most
  recent symptom fix (single star, rings, belts) this workstream
  structurally supersedes.
- `docs/FEATURES.md` row 178 + §"World-origin rebasing — pipeline crossing";
  `docs/SYSTEMS.md` `world-origin` row + pipeline-crosser note.
- `docs/JOURNEY.md` 35% (screensaver) + 60%/85% (rebasing as Layer-3
  prerequisite).
- Legacy `GAME_BIBLE` §"Scale System", §"Development Philosophy" (Principles
  2, 6) — `docs/ARCHIVE/GAME_BIBLE_LEGACY.md`.
- `~/.claude/projects/-home-ax/memory/well-dipper-rebasing-plan.md`,
  `well-dipper-testing-reference.md`, `chrome-devtools-9223-launch.md`.
