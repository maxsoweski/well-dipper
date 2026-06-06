# Warp Tunnel Pocket-Traversal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the microscopic, camera-pinned warp tunnel with a human-scale (~60u) pocket the camera physically flies through — into Portal A, through a real interior, out Portal B into the new system — reliably on every warp, with load-adaptive HYPER duration.

**Architecture:** Keep the existing dual-portal state machine and the existing swap-time seam (the warp already teleports the camera and re-anchors the portal around it mid-HYPER, behind opaque walls). Three changes to that spine: (1) scale the pocket from `~6.7e-5` to `~60` scene units so a small anchor error no longer means "see straight through"; (2) at the occluded swap seam, place Portal B *ahead* of the post-teleport camera and let the real `updateTraversal` plane-crossing fire the `INSIDE → OUTSIDE_B` emergence — instead of force-pinning `INSIDE` every frame; (3) gate emergence on destination-ready with a minimum cruise. The pocket stays a top-level scene child, so `maybeRebase` shifts it together with the camera (relative geometry preserved — already proven by `tests/warp-tunnel-rebase.test.js`); the teleport is absorbed by the one-time seam re-anchor. No camera-parenting, no rebase suppression.

**Tech Stack:** three.js (WebGL2, stencil portals), Vitest (headless unit tests), chrome-devtools MCP on GPU port 9223 (live integration), `window.__wd` debug surface + `runRepeatWarpSuite`.

---

## R1 RESOLUTION (the architectural spine — read before any task)

**The question (spec §7 R1):** where does the human-scale pocket live during warp, and how does it reconcile with the ~hundreds-to-thousands-unit camera teleport mid-HYPER and the world-origin rebase/reset?

**The answer — one scene-child pocket, repositioned once at the occluded swap seam:**

| Beat | Phase | Frame | Camera | Pocket |
|------|-------|-------|--------|--------|
| Approach | FOLD | origin system coords | warp drives camera forward toward Portal A | Portal A opened ahead at warp start; scene-child |
| Entry | ENTER | origin | camera crosses Portal A plane → `OUTSIDE_A → INSIDE` (real crossing) | scene-child; rebase-safe (shifts with camera) |
| Cruise + **seam** | HYPER | swap fires at elapsed>0.15 (occluded by walls) | `warpSwapSystem` teleports camera to destination approach | **re-anchor once:** rebuild pocket around new camera, Portal B placed ahead along new forward |
| Emergence | HYPER→EXIT | destination | camera flies forward, crosses Portal B plane → `INSIDE → OUTSIDE_B` | Portal B reachable only once destination-ready |

**Why this is robust (evidence, not assertion):**
- `maybeRebase` runs unguarded every sim tick (`main.js:5990`) — it is NOT suppressed during warp. But it recenters the camera AND subtracts the same offset from every top-level scene child, so a scene-child pocket keeps its camera-relative geometry across a rebase. This is exactly what `tests/warp-tunnel-rebase.test.js` ("maybeRebase does NOT orphan a scene-child tunnel") already proves. `warpPortal.group` is a top-level scene child (`main.js:1513`). Keep it that way.
- The teleport (`main.js:5274`, `camera.position.set(starPos + travel + orbit + coast)`) is the only frame discontinuity. It happens while the camera is `INSIDE` with opaque walls occluding everything (verified-good: GPU stall already hidden here). The existing seam re-anchor (`main.js:3012-3025`) already repositions the portal around the post-teleport camera — we repurpose it.
- After the seam, if `maybeRebase` fires again (camera far from new barycenter), the scene-child pocket shifts with the camera again. Safe.

**Why the human scale is what fixes the black HYPER:** the microscopic tunnel went black because a single anchor that landed even slightly off left a `6.7e-5`u tunnel hundreds of units from the camera — no overlap, see straight through. At ~60u the tunnel surrounds the camera with real margin; the anchor no longer has to be sub-micron-perfect.

**Why this differs from the reverted pin (`4285602`):** the pin forced `setTraversalMode('INSIDE')` every render frame and skipped `updateTraversal` — deleting the entry crossing, the forward orientation, and the emergence crossing (UAT-fail). Here the seam re-anchor is a ONE-TIME reposition while occluded; after it, `updateTraversal` runs freely so entry/cruise/emergence are all real crossings.

**R2 (stencil cost) resolution:** keep the current approach — the player is literally IN the origin scene approaching Portal A and IN the destination scene after emerging (the systems are the rendered scene on each side, not rendered-through-a-disc). The disc stencil only masks the tunnel interior's visibility per mode, exactly as today and as `portal-traversal-lab.html` does with its `systemAObjects`/`systemBObjects`. No full dual-system render-through-disc. This is the low-cost path and matches verified-good behavior.

**What's live-tuned (not guessed in this plan — exposed as debug knobs per spec R3/R4):** pocket length (start 60u), cruise speed (start ~20u/s → covers 60u in ~3s), bank/sway drift magnitude (start small), min-cruise seconds (start 3.5s). These are concrete starting values from the lab; final values are tuned in-browser during Task 7 and Max UAT.

---

## File structure

| File | Responsibility | Change |
|------|----------------|--------|
| `src/main.js` | warp per-frame update + swap orchestration | Revert pin/force/skip; fix FOLD-start guard; repurpose seam to place Portal B ahead; wire ready-gate |
| `src/effects/WarpEffect.js` | phase timing | HYPER becomes min-cruise + ready-gated extend; expose `destinationReady` flag |
| `src/effects/WarpPortal.js` | pocket rig + traversal | Delegate crossing math to new pure module; human-scale geometry |
| `src/effects/portalTraversal.js` (NEW) | pure plane-crossing state machine | Extracted from WarpPortal/lab; unit-testable |
| `src/core/ScaleConstants.js` | scale derivations | Human-scale tunnel length + dependent speeds |
| `tests/warp-tunnel-rebase.test.js` | headless gates | REPLACE pin-invariant tests with mode-sequence (AC2/AC4) + ready-gate (AC5) |
| `src/debug/integration-suite.js`, `src/debug/SceneInspector.js` | `runRepeatWarpSuite` harness | KEEP as-is (AC1 reliability harness) |

---

## Task 0: Revert the 4285602 choreography-killers (clean baseline)

**Files:**
- Modify: `src/main.js` (HYPER force-INSIDE/skip ~6634-6659; render-time pin ~7455-7470)

> Restores real traversal so the rest of the plan builds on choreography, not the pin. The seam re-anchor (`main.js:3012-3025`) is KEPT for now (Task 4 repurposes it). The `runRepeatWarpSuite` harness in `integration-suite.js`/`SceneInspector.js` is KEPT.

- [ ] **Step 1: Read the three revert sites and confirm current content**

Run: `grep -n "Continuous HYPER re-anchor\|setTraversalMode('INSIDE')\|warpPortal.group.position.copy(camera.position)" src/main.js`
Expected: matches near 6635, 6656, and ~7465.

- [ ] **Step 2: Revert the HYPER force-INSIDE + updateTraversal skip**

In `src/main.js` the dual-portal block currently reads (around 6634-6659):

```js
        if (warpEffect.state === 'hyper') {
          // ── Continuous HYPER re-anchor (warp-tunnel-frame-reanchor) ──
          // ... (long comment) ...
          warpPortal.setTraversalMode('INSIDE');
        } else {
          warpPortal.updateTraversal(camera);
        }
```

Replace the whole `if (warpEffect.state === 'hyper') { ... } else { ... }` with a single unconditional call so traversal runs in every warp phase:

```js
        // Run real plane-crossing traversal in every warp phase. The pocket is
        // human-scale (~60u, Task 2) so the camera physically crosses Portal A
        // (entry), cruises INSIDE, and crosses Portal B (emergence). No forced
        // INSIDE, no per-frame pin — the 4285602 choreography-killers are gone.
        warpPortal.updateTraversal(camera);
```

- [ ] **Step 3: Revert the render-time pin**

Run: `grep -n "warpPortal.group.position.copy(camera.position)" src/main.js`
Read the surrounding render-frame block (~7455-7470) and delete the per-frame pin block in its entirety (the `if (_useDualPortal && warpEffect.state === 'hyper')` render-time re-anchor introduced by 4285602). Leave the rest of `renderFrame` untouched.

- [ ] **Step 4: Run the existing suite to see expected red**

Run: `npx vitest run tests/warp-tunnel-rebase.test.js`
Expected: the pin-invariant tests now FAIL or are stale — that's expected; Task 1 replaces this file. Do NOT fix them here.

- [ ] **Step 5: Commit**

```bash
git add src/main.js
git commit -m "revert(warp): remove 4285602 HYPER pin/force-INSIDE/updateTraversal-skip

Restore real plane-crossing traversal in every warp phase. The pin
deleted entry/cruise/emergence choreography (Max UAT-fail 2026-06-06).
Pocket-traversal redesign builds choreography back on a human-scale
pocket. Seam re-anchor (onSwapSystem) and runRepeatWarpSuite harness
kept. Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 1: Extract pure traversal state machine + headless mode-sequence test (AC2, AC4)

**Files:**
- Create: `src/effects/portalTraversal.js`
- Modify: `src/effects/WarpPortal.js` (delegate `updateTraversal` to the pure module)
- Test: `tests/warp-tunnel-rebase.test.js` (REPLACE body)

> The crossing math is identical to `portal-traversal-lab.html:417-463`. Extracting it as a pure function makes the `OUTSIDE_A → INSIDE → OUTSIDE_B` sequence unit-testable without a WebGL context, and lets production and tests share one implementation.

- [ ] **Step 1: Write the failing test (replace the whole file body)**

Replace `tests/warp-tunnel-rebase.test.js` with:

```js
// Pocket-traversal: the warp tunnel is a human-scale pocket the camera flies
// through. These tests pin the OUTSIDE_A -> INSIDE -> OUTSIDE_B mode sequence
// (AC2 entry, AC4 emergence) via the pure plane-crossing state machine, and
// the load-adaptive emergence gate (AC5). Replaces the camera-pin invariant
// tests (mechanism reverted in Task 0).
import { describe, test, expect } from 'vitest';
import * as THREE from 'three';
import { createTraversal, stepTraversal } from '../src/effects/portalTraversal.js';

// A 60u pocket on the -Z axis: Portal A at z=0 facing +Z, Portal B at z=-60
// facing -Z, disc radius 3 (matches the lab).
const A_POS = new THREE.Vector3(0, 0, 0);
const A_NRM = new THREE.Vector3(0, 0, 1);
const B_POS = new THREE.Vector3(0, 0, -60);
const B_NRM = new THREE.Vector3(0, 0, -1);
const R = 3;

function flyThrough(zSamples) {
  let state = createTraversal('OUTSIDE_A');
  const modes = [];
  for (const z of zSamples) {
    const cam = new THREE.Vector3(0, 0, z);
    state = stepTraversal(state, { camPos: cam, aPos: A_POS, aNrm: A_NRM, bPos: B_POS, bNrm: B_NRM, discRadius: R });
    modes.push(state.mode);
  }
  return modes;
}

describe('pocket traversal mode sequence (AC2 entry / AC4 emergence)', () => {
  test('flying forward down the axis goes OUTSIDE_A -> INSIDE -> OUTSIDE_B', () => {
    // Start in front of Portal A (z>0), fly to behind Portal B (z<-60).
    const modes = flyThrough([20, 5, 1, -1, -30, -59, -61, -70]);
    expect(modes[0]).toBe('OUTSIDE_A');
    expect(modes).toContain('INSIDE');
    expect(modes[modes.length - 1]).toBe('OUTSIDE_B');
    // Order: first INSIDE index < first OUTSIDE_B index.
    expect(modes.indexOf('INSIDE')).toBeLessThan(modes.indexOf('OUTSIDE_B'));
    expect(modes.indexOf('INSIDE')).toBeGreaterThan(0); // not forced at start
  });

  test('a crossing off-axis (outside disc radius) does NOT enter', () => {
    let state = createTraversal('OUTSIDE_A');
    const cam = new THREE.Vector3(10, 0, -1); // past the plane but lat=10 > R
    state = stepTraversal(state, { camPos: cam, aPos: A_POS, aNrm: A_NRM, bPos: B_POS, bNrm: B_NRM, discRadius: R });
    expect(state.mode).toBe('OUTSIDE_A');
  });

  test('entry is a real crossing, not a forced set', () => {
    // One step where the camera is already past the plane but we never called
    // a force-set: mode only flips because the plane was crossed between steps.
    let state = createTraversal('OUTSIDE_A');
    state = stepTraversal(state, { camPos: new THREE.Vector3(0,0,5), aPos:A_POS,aNrm:A_NRM,bPos:B_POS,bNrm:B_NRM,discRadius:R });
    expect(state.mode).toBe('OUTSIDE_A'); // seeds dot history, no crossing yet
    state = stepTraversal(state, { camPos: new THREE.Vector3(0,0,-1), aPos:A_POS,aNrm:A_NRM,bPos:B_POS,bNrm:B_NRM,discRadius:R });
    expect(state.mode).toBe('INSIDE'); // crossing detected
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/warp-tunnel-rebase.test.js`
Expected: FAIL — `portalTraversal.js` does not exist / `createTraversal is not a function`.

- [ ] **Step 3: Write the pure module**

Create `src/effects/portalTraversal.js` (math ported verbatim from `portal-traversal-lab.html:417-463`):

```js
// Pure portal-traversal state machine — dot-product plane-crossing detection
// (Metzler-Gilbertz 2021). No THREE.js objects mutated; takes plain vectors,
// returns a new immutable-ish state. Shared by WarpPortal.updateTraversal and
// the headless tests so production and tests agree by construction.

export function createTraversal(mode = 'OUTSIDE_A') {
  return { mode, prevDotA: null, prevDotB: null };
}

// camPos/aPos/bPos: THREE.Vector3 (or any {x,y,z} with .dot via THREE).
// aNrm/bNrm: portal normals. discRadius: lateral capture radius.
export function stepTraversal(state, { camPos, aPos, aNrm, bPos, bNrm, discRadius }) {
  let { mode, prevDotA, prevDotB } = state;

  // Lateral distance from a portal's local axis (assumes axis ~ pocket centerline).
  const lat = (p) => Math.sqrt(
    (camPos.x - p.x) * (camPos.x - p.x) + (camPos.y - p.y) * (camPos.y - p.y)
  );

  // ── Portal A plane (entry/back-out) ──
  const dotA = (camPos.x - aPos.x) * aNrm.x + (camPos.y - aPos.y) * aNrm.y + (camPos.z - aPos.z) * aNrm.z;
  if (prevDotA !== null) {
    if (mode === 'OUTSIDE_A' && prevDotA > 0 && dotA <= 0 && lat(aPos) <= discRadius) {
      mode = 'INSIDE';
    } else if (mode === 'INSIDE' && prevDotA < 0 && dotA >= 0 && lat(aPos) <= discRadius) {
      mode = 'OUTSIDE_A';
    }
  }
  prevDotA = dotA;

  // ── Portal B plane (emergence/re-enter) ──
  const dotB = (camPos.x - bPos.x) * bNrm.x + (camPos.y - bPos.y) * bNrm.y + (camPos.z - bPos.z) * bNrm.z;
  if (prevDotB !== null) {
    if (mode === 'INSIDE' && prevDotB < 0 && dotB >= 0 && lat(bPos) <= discRadius) {
      mode = 'OUTSIDE_B';
    } else if (mode === 'OUTSIDE_B' && prevDotB > 0 && dotB <= 0 && lat(bPos) <= discRadius) {
      mode = 'INSIDE';
    }
  }
  prevDotB = dotB;

  return { mode, prevDotA, prevDotB };
}
```

- [ ] **Step 4: Run to verify the test passes**

Run: `npx vitest run tests/warp-tunnel-rebase.test.js`
Expected: the two AC2/AC4 describe-block tests PASS (the AC5 gate test is added in Task 5).

- [ ] **Step 5: Delegate `WarpPortal.updateTraversal` to the pure module**

In `src/effects/WarpPortal.js`, locate `updateTraversal(camera)` (~723-790) and `_prevDotA`/`_prevDotB`/`_traversalMode`. Replace the inline dot-product logic with a call into the pure module, keeping the side effects (mode-change → `setTraversalMode` visibility flips, `onTraversal('INSIDE')` callback). Sketch:

```js
import { createTraversal, stepTraversal } from './portalTraversal.js';
// in constructor: this._trav = createTraversal('OUTSIDE_A');
updateTraversal(camera) {
  const prevMode = this._trav.mode;
  this._trav = stepTraversal(this._trav, {
    camPos: camera.position,
    aPos: this._portalAWorldPos, aNrm: this._portalAWorldNormal,
    bPos: this._portalBWorldPos, bNrm: this._portalBWorldNormal,
    discRadius: this._discRadiusScene,
  });
  if (this._trav.mode !== prevMode) {
    this.setTraversalMode(this._trav.mode);   // existing visibility flips
    if (this._trav.mode === 'INSIDE' && prevMode === 'OUTSIDE_A' && this._onTraversal) {
      this._onTraversal('INSIDE');            // existing onSwapSystem trigger
    }
  }
}
// resetTraversal(): this._trav = createTraversal('OUTSIDE_A'); + existing visibility reset
```

Confirm `_portalAWorldPos`/normal and `_portalBWorldPos`/normal are derived from the group transform in `open()` (they must be world-space; if the current code only stores Portal A, add Portal B world pose in `open()`).

- [ ] **Step 6: Run the full unit suite to confirm no regression**

Run: `npx vitest run`
Expected: all green (or only Task-5-pending AC5 test absent).

- [ ] **Step 7: Commit**

```bash
git add src/effects/portalTraversal.js src/effects/WarpPortal.js tests/warp-tunnel-rebase.test.js
git commit -m "feat(warp): extract pure traversal state machine + mode-sequence tests (AC2/AC4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Scale the pocket to human scale (~60u)

**Files:**
- Modify: `src/core/ScaleConstants.js` (`TUNNEL_LENGTH_TO_SHIP` / `tunnelLengthScene`, ~196-244)
- Modify: `src/effects/WarpPortal.js` (tunnel geometry build + disc radius, ~106-129, ~328-337)

> The tunnel geometry is currently built once at `tunnelLengthScene()` ≈ 6.7e-5u. Make it ~60u and the disc radius ~3u, matching the lab. Dependent phase speeds (`hyperTraversalScenePerSec` etc.) recompute from the new length so the camera covers the pocket in HYPER_DUR.

- [ ] **Step 1: Read current scale derivation**

Run: `grep -n "TUNNEL_LENGTH_TO_SHIP\|tunnelLengthScene\|hyperTraversalScenePerSec\|portalPreviewDistanceScene\|DISC_RADIUS\|discRadius" src/core/ScaleConstants.js src/effects/WarpPortal.js`

- [ ] **Step 2: Set a fixed human-scale pocket length**

In `src/core/ScaleConstants.js`, change `tunnelLengthScene()` to return a fixed `WARP_POCKET_LENGTH = 60` scene units (export the constant), instead of `shipLengthScene * TUNNEL_LENGTH_TO_SHIP`. Keep the function name so callers are unchanged. Verify `hyperTraversalScenePerSec(dur)` returns `tunnelLengthScene() / dur` (≈ 20u/s at 3s) and `portalPreviewDistanceScene()` returns a sane approach distance (e.g. `tunnelLengthScene() * 0.5` so FOLD lands the camera at Portal A).

- [ ] **Step 3: Build the tunnel + discs at human scale in WarpPortal**

In `src/effects/WarpPortal.js`, set the disc radius to ~3u and rebuild the cylinder at `tunnelLengthScene()` (now 60). Ensure both Portal A (z=0, +Z) and Portal B (z=-tunnelLength, -Z) discs + rims exist, mirroring `portal-traversal-lab.html:132-158`. Store `this._discRadiusScene = 3`.

- [ ] **Step 4: Manual headless geometry sanity (no full WebGL)**

Run: `node -e "import('./src/core/ScaleConstants.js').then(m=>console.log('len', m.tunnelLengthScene(), 'hyperSpd', m.hyperTraversalScenePerSec(3)))"`
Expected: `len 60 hyperSpd 20`.

- [ ] **Step 5: Commit**

```bash
git add src/core/ScaleConstants.js src/effects/WarpPortal.js
git commit -m "feat(warp): human-scale pocket (60u tunnel, 3u disc) replacing microscopic tunnel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Real camera fly-through during HYPER + fix the FOLD-start guard

**Files:**
- Modify: `src/main.js` (FOLD-start portal open guard ~6620; HYPER camera motion already wired via `warpEffect.cameraForwardSpeed`)

> With the pocket at 60u and `_hyperSpeed` ≈ 20u/s, the existing forward-push (`main.js:6767-6791`, driven by `warpEffect.cameraForwardSpeed`) now moves the camera a real 60u through the pocket during HYPER — no code change needed there beyond Task 2's scale. The remaining fix: a fresh Portal A must open at every warp start, including repeats.

- [ ] **Step 1: Fix the FOLD-start open guard**

In `src/main.js` (~6619-6628) the open is gated by `if (!warpPortal.group.visible)`, which a leftover-visible Portal B from the prior warp can block. Reset/hide the portal at warp START so a fresh Portal A always opens. Change the guard to open on warp-start regardless of leftover visibility:

```js
      if (_useDualPortal) {
        // Open a fresh Portal A on the first frame of every warp (FOLD t=0),
        // even if a leftover Portal B from the prior warp is still visible.
        if (warpEffect.state === 'fold' && !warpPortal._openedThisWarp) {
          warpPortal._openedThisWarp = true;
          const portalAPos = camera.position.clone()
            .addScaledVector(_tunnelForward, portalPreviewDistanceScene());
          warpPortal.resetTraversal();
          warpPortal.open(portalAPos, _tunnelForward);
        }
```

And clear the flag when the warp ends — in `warpEffect.onComplete` (`main.js:3051`) add `warpPortal._openedThisWarp = false;`.

- [ ] **Step 2: Live smoke (chrome-devtools GPU 9223)**

Per `memory/well-dipper-testing-reference.md`: `window._lab.enterSol()`, then `_autoSelectWarpTarget()` → `_beginWarpTurn()`. Watch HYPER: the camera should visibly move forward through the tunnel (not static). Take a screenshot mid-HYPER.
Expected: tunnel renders; camera advances. (Reliability/repeat verified in Task 7.)

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "fix(warp): open fresh Portal A on every warp start (incl. repeats)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Repurpose the swap seam — place Portal B ahead of the post-teleport camera

**Files:**
- Modify: `src/main.js` (`onSwapSystem` re-anchor block ~3001-3025)

> Today the seam re-opens Portal A at the post-teleport camera and forces INSIDE. Repurpose it: after the teleport, keep the camera INSIDE (occluded), rebuild the pocket so Portal A is just behind the camera and **Portal B is `tunnelLength` ahead along the new forward** — so the camera will fly forward and cross Portal B for a real emergence.

- [ ] **Step 1: Rewrite the seam re-anchor**

Replace the `if (_useDualPortal) { ... }` block at `main.js:3012-3025` with:

```js
  if (_useDualPortal) {
    camera.getWorldDirection(_swapNewForward);
    // Place the pocket so the camera is INSIDE near Portal A, with Portal B a
    // full pocket-length AHEAD along the post-teleport forward. The walls
    // occlude this reposition (we are mid-HYPER). The camera then flies forward
    // and crosses Portal B for a REAL emergence (no forced OUTSIDE_B snap).
    _swapPortalAPos.copy(camera.position).addScaledVector(_swapNewForward, -1e-3);
    warpPortal.resetTraversal();
    warpPortal.open(_swapPortalAPos, _swapNewForward);
    warpPortal.setTraversalMode('INSIDE');   // we ARE inside at the seam
    // Re-seed dot history so the next updateTraversal measures crossings from
    // the new pocket pose (prevDot* null = no spurious crossing on frame 1).
    warpPortal._trav = { mode: 'INSIDE', prevDotA: null, prevDotB: null };
  }
```

(Replaces the `_prevDotA/_prevDotB = null` lines with the pure-state re-seed from Task 1.)

- [ ] **Step 2: Confirm Portal B world pose is derived in `open()`**

In `WarpPortal.open(pos, dir)` (~589-594) confirm it sets `_portalBWorldPos = pos + dir*(-tunnelLength)` and `_portalBWorldNormal = -dir` (so Task 1's `updateTraversal` measures the B-plane correctly). If only Portal A pose is stored, add Portal B.

- [ ] **Step 3: Live verify the emergence crossing fires**

Live (GPU 9223): drive one warp from Sol. In console, sample `window._warpPortal._trav.mode` each second during HYPER/EXIT.
Expected: sequence reaches `OUTSIDE_A` → `INSIDE` → `OUTSIDE_B` before `onComplete`. No black HYPER.

- [ ] **Step 4: Commit**

```bash
git add src/main.js
git commit -m "feat(warp): seam re-anchor places Portal B ahead for a real emergence crossing

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Load-adaptive emergence gate (AC5)

**Files:**
- Modify: `src/effects/WarpEffect.js` (`destinationReady` flag; HYPER min-cruise + ready-gated transition ~247-282)
- Modify: `src/main.js` (set `warpEffect.destinationReady = true` after `spawnSystem` completes in `onSwapSystem`)
- Test: `tests/warp-tunnel-rebase.test.js` (add AC5 describe block)

> HYPER currently transitions to EXIT on a pure timer (`WarpEffect.js:278`). Make it transition only when BOTH the minimum cruise elapsed AND the destination is ready. The GPU `spawnSystem` is synchronous inside `onSwapSystem`, so set `destinationReady` right after it.

- [ ] **Step 1: Write the failing AC5 test**

Add to `tests/warp-tunnel-rebase.test.js`:

```js
import { WarpEffect } from '../src/effects/WarpEffect.js';

describe('load-adaptive emergence gate (AC5)', () => {
  function runHyper(we, { readyAt, dt = 0.1, maxT = 30 }) {
    we.state = 'hyper'; we.elapsed = 0; we.destinationReady = false;
    let t = 0;
    while (we.state === 'hyper' && t < maxT) {
      t += dt;
      if (t >= readyAt) we.destinationReady = true;
      we.update(dt);
    }
    return t; // total HYPER time before it left HYPER
  }

  test('emergence waits past the minimum cruise when the load is slow', () => {
    const we = new WarpEffect();
    const min = we.HYPER_MIN_CRUISE; // new constant
    const t = runHyper(we, { readyAt: min + 2.0 });
    expect(t).toBeGreaterThan(min + 1.9); // extended until ready
  });

  test('with a fast load, HYPER lasts exactly the minimum cruise', () => {
    const we = new WarpEffect();
    const min = we.HYPER_MIN_CRUISE;
    const t = runHyper(we, { readyAt: 0.05 });
    expect(t).toBeGreaterThanOrEqual(min);
    expect(t).toBeLessThan(min + 0.25); // no needless extension
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/warp-tunnel-rebase.test.js -t "load-adaptive"`
Expected: FAIL — `HYPER_MIN_CRUISE` undefined / HYPER ends on the old timer.

- [ ] **Step 3: Implement the gate in WarpEffect**

In `src/effects/WarpEffect.js`:
- In the constructor add `this.HYPER_MIN_CRUISE = 3.5;` and `this.destinationReady = false;` and reset `destinationReady=false` in `start()`.
- In `_updateHyper()` replace the transition guard (`if (this.elapsed >= this.HYPER_DUR)`) with:

```js
    // Load-adaptive: leave HYPER only when the minimum cruise has elapsed AND
    // the destination finished spawning. A slow load extends the cruise; a fast
    // load leaves at exactly the minimum. Keeps the GPU hitch buried mid-cruise.
    if (this.elapsed >= this.HYPER_MIN_CRUISE && this.destinationReady) {
      this.state = 'exit';
      this.elapsed = 0;
    }
```

- [ ] **Step 4: Set the ready flag after spawn in main.js**

In `src/main.js` `onSwapSystem`, immediately after `warpSwapSystem();` (and the seam re-anchor) add:

```js
  // Destination scene is now spawned (warpSwapSystem ran spawnSystem
  // synchronously). Release the emergence gate (WarpEffect AC5).
  warpEffect.destinationReady = true;
```

- [ ] **Step 5: Run to verify the AC5 tests pass**

Run: `npx vitest run tests/warp-tunnel-rebase.test.js`
Expected: all describe blocks (AC2/AC4 + AC5) PASS.

- [ ] **Step 6: Live verify the gate under an artificial slow load**

Live (GPU 9223): in console, temporarily wrap to delay readiness, e.g. set a flag the seam respects, or stub `pendingSystemDataPromise` to resolve after ~6s, then warp.
Expected: HYPER cruise visibly extends (tunnel keeps streaming) until ready, then emerges — never emerges into a half-loaded system.

- [ ] **Step 7: Commit**

```bash
git add src/effects/WarpEffect.js src/main.js tests/warp-tunnel-rebase.test.js
git commit -m "feat(warp): load-adaptive HYPER — min-cruise + destination-ready emergence gate (AC5)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Camera on-rails + drift polish

**Files:**
- Modify: `src/main.js` (warp camera-motion block ~6759-6791)

> The camera is already warp-driven and forward-facing. Add a subtle bank/sway drift so it reads as piloted, not locked — without inducing off-axis entry or backward-looking (spec R4: keep small, tune live). No WASD during warp (already suppressed via `cameraController.bypassed`).

- [ ] **Step 1: Add a small drift offset during HYPER**

In the warp camera block, after the forward-push, add a low-amplitude positional/rotational sway driven by `warpEffect.hyperTime` (e.g. `sin`/`cos` at ~0.3-0.6 Hz, amplitude a few tenths of a unit laterally + a fraction of a degree of bank). Keep the camera's forward axis dominant so Portal B stays ahead. Expose amplitude as `window._warpDriftAmp` for live tuning.

- [ ] **Step 2: Live tune**

Live (GPU 9223): warp and watch. Adjust `window._warpDriftAmp` until it reads "piloted" without the entry angle going off-head-on or any backward feel. Record the chosen value back into the code.

- [ ] **Step 3: Commit**

```bash
git add src/main.js
git commit -m "feat(warp): subtle on-rails camera bank/sway drift (piloted feel)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Live verification (AC1 reliability + AC3 forward-travel) + docs

**Files:**
- Modify: `docs/FEATURES/warp.md`, `docs/NOW.md` (per CLAUDE.md Rule 3 doc-updates-on-ship)
- Use: `window.__wd.runRepeatWarpSuite()`, `takeSceneInventory()`

> The headless gates (AC2/AC4/AC5) are green from Tasks 1/5. AC1 (reliable render across repeats/far) and AC3 (monotonic forward travel) are live-integration — verify on GPU 9223, then this goes VERIFIED_PENDING_MAX for AC6 UAT.

- [ ] **Step 1: AC1 — reliability across many runs**

Live: `window._lab.enterSol()`, then run `window.__wd.runRepeatWarpSuite()` and a manual chain of ≥8 warps (repeats + a far target). For each HYPER frame sample `takeSceneInventory().meshes.find(m=>m.name==='effect.warp.tunnel')` — assert present + `inFrustum` + `cameraDistance` small, and `window._warpPortal._trav.mode` reaches INSIDE.
Expected: 10/10 warps render every HYPER frame; zero black HYPER.

- [ ] **Step 2: AC3 — monotonic forward travel + forward facing**

Live: during one HYPER, sample per frame: camera position projected onto the pocket axis, and `cameraForward·axis`.
Expected: axis-distance increases monotonically; `cameraForward·axis > 0` throughout (no backward orientation).

- [ ] **Step 3: Run the full headless suite once more**

Run: `npx vitest run`
Expected: all green.

- [ ] **Step 4: Update docs**

Update `docs/FEATURES/warp.md` (mechanism = human-scale pocket fly-through; load-adaptive HYPER) and `docs/NOW.md` (workstream → VERIFIED_PENDING_MAX). Run `npm run doc-rot` — must be clean.

- [ ] **Step 5: Run the verify-workstream workflow**

```
Workflow({scriptPath:"/home/ax/projects/personal-os-improvements/dev-collab/workflows/verify-workstream.mjs",
  args:{contractPath:"docs/WORKSTREAMS/warp-tunnel-pocket-traversal-2026-06-06/contract.json", mode:"full", commit:"<sha>", liveBranch:"main"}})
```
Expected: AC1-AC5 PASS (AC6 marked `deferred-to-max`). Then set workstream status `VERIFIED_PENDING_MAX <sha>`.

- [ ] **Step 6: Commit**

```bash
git add docs/
git commit -m "docs(warp): pocket-traversal verified (AC1-5); VERIFIED_PENDING_MAX

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:** AC1→Task7.1; AC2→Task1; AC3→Task7.2; AC4→Task1+Task4; AC5→Task5; AC6→Max UAT after Task7. Revert (spec §3.6)→Task0. FOLD-start fix (spec §3.6)→Task3. Human scale (spec §3.1)→Task2. Seam/R1 (spec §7 R1)→Task4 + R1 section. Load-adaptive (spec §3.4)→Task5. Drift (spec §3.3)→Task6. Keep-the-look (spec §3.5)→untouched shader (verify in Task7).
- **Live-tuned values are concrete starting points** (60u, 20u/s, 3.5s min-cruise, small drift) with debug knobs — not placeholders; final values set in Task 6/7 + UAT.
- **Type consistency:** the pure traversal state `{mode, prevDotA, prevDotB}` from `createTraversal`/`stepTraversal` is used identically in Task 1 (module + WarpPortal delegate + tests) and Task 4 (seam re-seed).
- **Risk to flag to Max:** Task 1 Step 5 assumes `WarpPortal.open()` can store both portals' world poses; if the current class only tracks Portal A, that's a small add (noted in Task 4 Step 2). Everything else builds on verified-good existing structure.
