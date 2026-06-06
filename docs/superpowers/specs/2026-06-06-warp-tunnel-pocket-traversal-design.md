# Warp Tunnel — Pocket Traversal Redesign

**Date:** 2026-06-06
**Workstream (to re-scope):** `warp-tunnel-frame-reanchor-2026-06-06` → propose rename to
`warp-tunnel-pocket-traversal-2026-06-06` ("reanchor" is no longer the mechanism).
**Supersedes mechanism in:** commit `4285602` (continuous re-anchor) — to be reverted.
**JOURNEY / tier:** Travel-loop signature moment — the warp is a felt set-piece, not a loading screen.
**Status:** Design approved by Max 2026-06-06. Spec → re-scope contract → TDD implement (next session).

---

## 1. Problem

The dual-portal warp has the **right state machine** (`OUTSIDE_A → INSIDE → OUTSIDE_B`,
plane-crossing detection in `WarpPortal.updateTraversal`) but the **wrong spatial model**.

To fit the tunnel into world-space next to a star system, it was shrunk to
`tunnelLength ≈ 6.7e-5` scene units — microscopic. The camera can't physically fly
through something that small, so travel was faked with texture scroll (`uScroll`) while
the camera stayed ~static at scene scale. That fragility caused **black HYPER** on repeat
warps: a single swap-time anchor for the tiny tunnel was unreliable across the
repeat-warp / fallback-timer / teleport paths, so the tunnel often sat hundreds of units
away and the player saw straight through to the starfield.

Commit `4285602` papered over the symptom: it force-pinned the tunnel to the camera every
render frame, forced render-mode `INSIDE`, and skipped `updateTraversal` during HYPER. That
guarantees pixels but **deletes the choreography**. Max's UAT (2026-06-06) failed on exactly
the three things the pin removed:

- **Entry:** rarely sees the entrance; when seen, the angle is wrong (not flying head-on into Portal A).
- **During HYPER:** sometimes oriented as if looking *backward* through the tunnel.
- **Exit:** no sense of emerging — it freezes, then he's in the new system.

Root causes, mapped to the pin:
- forced `INSIDE` → no felt `OUTSIDE_A → INSIDE` entry crossing (wrong/absent approach).
- per-frame pin (`group.lookAt(camera.position − forward)`) → no directional travel; backward-looking orientation.
- skipped `updateTraversal` → `INSIDE → OUTSIDE_B` never fires → emergence is a snap at `onComplete` ("freeze, then new system").

Also contributing to the original orphan (independent of the pin): the FOLD-start guard
`if (!warpPortal.group.visible)` skips opening a fresh Portal A on a repeat warp, because a
leftover-visible Portal B from the prior warp keeps the group visible.

## 2. Goal — the felt journey

> Approach a hole in space → fly **into** it → travel a real interior that *feels* long →
> emerge **out** the far hole into the new system.

Max's framing (2026-06-06): "Cheat the scale. The tunnel does not have to be as big as a
system — make it relatively small and make the player's speed through it such that it seems
long. I want the tunnel to appear as a hole in space on both ends, and a physical space
you're moving into and out of."

## 3. Design

### 3.1 Spatial model — decoupled human-scale pocket

The tunnel stops living in system-space. During the warp it is its **own pocket of space**
at human scale (~60 units long, lab-proven), decoupled from system/world coordinates. The
camera **physically flies through it**. Portal A's disc is the hole you fly *into*; Portal
B's disc is the hole you emerge *out of*. Both ends are stencil-masked discs — real holes in
space. Transitions are genuine plane-crossings with real margin, so they fire reliably and
*read* as crossing a threshold.

**Reference implementation:** `portal-traversal-lab.html` (untracked, in tree). It already
implements this exact mechanism: Portal A at z≈0, Portal B at z≈−60, camera free-flies
through at ~20 u/s, same three-state machine, `systemA` objects visible only in `OUTSIDE_A`,
`systemB` only in `OUTSIDE_B`, tunnel stencil off only `INSIDE`. This is the spatial model to
port into production. (Not yet run/verified this session — it is a complete implementation,
not a sketch.)

### 3.2 Phase mapping

| WarpEffect phase | Felt beat | Portal mode |
|---|---|---|
| FOLD | Approach Portal A (the hole appears ahead, camera flies toward it) | `OUTSIDE_A` |
| ENTER | Cross **into** Portal A — fires `onSwapSystem` (teleport + spawn, hidden behind walls) | `OUTSIDE_A → INSIDE` |
| HYPER | Cruise the interior — walls stream; **held until destination ready** | `INSIDE` |
| EXIT | Emerge **out** through Portal B into the new system | `INSIDE → OUTSIDE_B` |

The system swap (`warpSwapSystem` → `spawnSystem`) stays buried mid-cruise: the camera is
deep inside the tunnel and the walls occlude the swap, exactly as today.

### 3.3 Camera — on-rails with drift

Camera auto-flies forward down the tunnel centerline (on-rails), **fixed forward-facing** so
the exit hole is always ahead (kills "looking backward"). Add a **subtle bank/sway drift** so
it reads as piloted, not locked. No player WASD during the warp (it is a signature cutscene
moment).

### 3.4 Load-adaptive duration

The warp's real job is to mask background load. So HYPER duration is **not fixed**:

- HYPER has a **minimum cruise time** (the felt-journey beat — long enough to register
  approach → immersion → emergence as distinct beats; start ~3.5–4.5s, UAT-tunable).
- Emergence (reaching Portal B / `INSIDE → OUTSIDE_B`) is **gated on the destination being
  ready**: `pendingSystemDataPromise` resolved *and* `spawnSystem` completed.
- If a load runs long, the cruise **keeps flying the interior** (extends) until ready, then
  reaches Portal B and emerges. On fast loads it's just the minimum.
- The GPU hitch from `spawnSystem` is buried mid-cruise — never at the emergence moment.

Today's load reality (verified 2026-06-06): the heavy procedural generation is already async,
run during the 4s FOLD via `onPrepareSystem` (`pendingSystemDataPromise`) — usually done
before HYPER. The remaining synchronous cost is `spawnSystem` (GPU resource creation only) +
sky rebuild. The gate handles the slow-load tail robustly.

### 3.5 Keep the look

Unchanged: streaming wall starfield (`uScroll`), rim glow, origin→destination color-mix
(`uDestMix` / `portalBridgeMix`), landing strip on `OUTSIDE_B`. Only the spatial and temporal
models change.

### 3.6 Revert / fix list

- **Revert** the `4285602` choreography-killers: the `renderFrame()` per-frame pin, the
  forced `setTraversalMode('INSIDE')` during HYPER, and the `updateTraversal` skip. Let
  traversal run.
- **Fix the FOLD-start skip:** reset/hide `warpPortal` at warp **start** so a fresh Portal A
  always opens on every warp (incl. repeats) — no leftover-visible Portal B blocking it.
- **Keep** the Face-A `onSwapSystem` re-anchor concept only insofar as the teleport must not
  orphan the pocket; in the pocket model the tunnel lives in its own rig, so re-anchoring is
  about reconciling the rig with the post-teleport camera (see Risk R1).

## 4. Components touched

- `src/effects/WarpEffect.js` — phase timing; HYPER becomes min-cruise + ready-gated extend.
- `src/effects/WarpPortal.js` — pocket rig at human scale; traversal unchanged in spirit.
- `src/main.js` — warp update block (~6612–6660): remove pin/forced-INSIDE/skip; warp-start
  portal reset; camera on-rails+drift; ready-gate wiring; `warpSwapSystem` ready signal.
- System spawn path — expose a "destination ready" signal (`pendingSystemDataPromise` +
  post-`spawnSystem` flag) for the emergence gate.

## 5. Acceptance criteria (felt journey — encode objectively where possible)

1. **Reliable render:** 10/10 consecutive/repeat warps render the tunnel every HYPER frame
   (no black). (Regression guard — `runRepeatWarpSuite` / `warp-tunnel-rebase.test.js`.)
2. **Entry into the hole:** every warp traverses `OUTSIDE_A → INSIDE` via a real plane
   crossing (`insideAt` non-null, reached from `OUTSIDE_A`, not forced). Camera approaches
   Portal A roughly head-on.
3. **Real interior travel:** during HYPER the camera advances forward through the pocket
   (monotonic forward progress along tunnel axis), facing forward.
4. **Emergence out the far hole:** every warp traverses `INSIDE → OUTSIDE_B` via a real
   plane crossing **before** EXIT completes — not a snap at `onComplete`.
5. **Load-adaptive:** emergence does not occur until destination-ready is true; on an
   artificially delayed load, HYPER cruise extends rather than emerging into a half-loaded
   system.
6. **Holistic feel (Max UAT, deferred-to-max):** the warp reads as into-hole → travel →
   out-of-hole; no looking-backward; no freeze-then-snap. **Max's gate alone.**

## 6. Testing

- **Headless (TDD):** extend `tests/warp-tunnel-rebase.test.js` — assert the full mode
  sequence `OUTSIDE_A → INSIDE → OUTSIDE_B` is traversed (AC2/3/4), and the ready-gate holds
  emergence under a stubbed slow load (AC5).
- **Live (chrome-devtools, GPU 9223, page 1):** drive a chain of warps from Sol; verify mode
  sequence, forward camera progress, and reliable render via `takeSceneInventory()` +
  screenshots. Bump HYPER min-cruise for screenshot latency, then restore.
  Per `memory/well-dipper-testing-reference.md`: chrome-devtools not Playwright;
  `window._lab.enterSol()`; `_autoSelectWarpTarget()` → `_beginWarpTurn()`.
- **UAT:** Max rides several warps (incl. repeats, far targets) — the felt journey is his gate.

## 7. Risks / open questions for the plan

- **R1 — Pocket ↔ world-coords reconciliation (primary).** The lab lives in a static world;
  production teleports the camera between huge system coords and rebases the world origin.
  The plan must work out where the pocket rig lives during the warp and how it reconciles
  with the post-teleport camera so the holes frame the correct system on each side. This is
  the main integration unknown and should be resolved first (likely a dedicated warp-local
  rig, with systems rendered through the discs / faded as today).
- **R2 — Stencil cost.** Rendering a full star system "through" Portal A/B discs may be
  heavier than the lab's few objects. May need to keep the current scene-fade approach (only
  the immediate destination visible through Portal B at emergence) rather than full
  dual-system stencil. Decide in plan.
- **R3 — Speed × length tuning.** ~60u at the chosen min-cruise gives the speed; must read as
  "long" without feeling slow on repeat warps. UAT-tunable; expose as a debug knob.
- **R4 — Drift magnitude.** Bank/sway must add life without inducing the looking-backward /
  off-axis-entry feel. Keep small; tune live.
- **R5 — Revert blast radius.** `4285602` also touched `integration-suite.js` /
  `SceneInspector.js` (the `runRepeatWarpSuite` harness) — keep the harness, revert only the
  pin/force/skip in `main.js`.

## 8. Out of scope

- World-origin rebasing at ship scale (separate deferred plan).
- Save/share system seed-tags; binary wide-separation (separate parking-lot items).
- Any change to the tunnel's *visual* shader (walls/rim/color-mix stay).
