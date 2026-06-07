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

## STATUS — 2026-06-07 (C-lite arrival polish; AC4 root cause CORRECTED by live diagnosis)

**Tasks 0–3 DONE** (commits `1427ebb`/`9c334c2`/`a16d617`/`7064478` + entry-side Fix D `1654dcb`). The 4285602 pin is gone — the render loop calls real `updateTraversal` (`main.js:6645`). AC2 entry crossing verified live (fires `onSwapSystem` during ENTER ~el 0.25).

**Tasks 4–7 below were REWRITTEN 2026-06-07** after a live diagnosis (3 instrumented Sol→star warps, GPU 9223) that overturned the handoff's "place Portal B ahead" framing. Measured facts:

- **AC4 is blocked by a teleport+rebase DETACHMENT, not by placement.** The seam re-anchor *already* plants Portal B exactly 60u ahead (measured `camToDiscB = 60`, mode INSIDE). But `warpSwapSystem` teleports the camera to a large coord + calls `resetWorldOrigin()` (which by design does **not** move scene children — `WorldOrigin.js:180`); the next frame's `maybeRebase` resets the camera to origin. Because `onSwapSystem` is **async (awaits before teleporting)**, its re-anchor races with `maybeRebase`, leaving the group and camera in different frames → Portal B ends up **785–1730u away** the whole cruise → camera never reaches the 3u gate → mode stays INSIDE → `OUTSIDE_B` is force-flipped at `onComplete` (the snap). **Max-approved fix: make the pocket rebase-proof** — anchor it in true-world coords + per-frame rewrite `group.position = anchorTrue − worldOrigin` (mirrors the celestial-body writes at `main.js:6075`).
- **`exitPeakSpeed = 6.7e-7`** (stale microscopic-era value) → EXIT contributes ~0 forward travel. The emergence must fire **during HYPER** (post-swap HYPER travel `(3.0−0.15)×20 ≈ 57u` is also 3u short of 60u — fixed by AC5's longer min-cruise).
- **AC9's 324ms freeze did NOT reproduce** with warm shaders (max real frame ~24ms). It's cold-shader / first-warp-of-session only — keep AC9 but expect it intermittent, not every-warp.

> **Reusable probe (this session):** a per-frame sampler that wraps `_warpPortal.updateTraversal` (gives the camera ref), `setTraversalMode`, `onSwapSystem`, `onComplete` — recording `dt / state / elapsed / cameraForwardSpeed / _swapFired / _trav.mode / group.visible / _tunnel.visible / dotB / latB / camLen / camToDiscB`. Rebuild it for the AC4/AC7/AC9/AC10 live checks. **Testing how-to:** `memory/well-dipper-testing-reference.md` (GPU 9223; `select_page({bringToFront:true})` FIRST or fps lies; `window._lab.enterSol()`; `for(let i=0;i<5;i++)window._lab.stopAutopilot()`; `_autoSelectWarpTarget()` until `!_warpTarget.galaxyData`; `_beginWarpTurn()`).

---

## Task 4: True-world-anchored, rebase-proof pocket (AC4 reachability + AC7 stationarity) + locked post-swap axis

**Files:**
- Modify: `src/main.js` — WorldOrigin imports (~58-64); seam re-anchor (`onSwapSystem` ~3011-3025); new scratch vectors (~1596); the warp dual-portal block (rewrite group from anchor, ~6644 before the `updateTraversal` at 6645); the post-swap camera advance (~6766); REMOVE the per-frame portal-follow (~6803-6815)
- Test: `tests/warp-tunnel-rebase.test.js` (headless: relative camera↔PortalB geometry survives a rebase offset)

> The portal group must hold a fixed distance from the camera across the async teleport+`resetWorldOrigin`+`maybeRebase` seam. Stop relying on `maybeRebase`'s scene-child shift (it races with the swap). Store the pocket's true-world anchor once at the seam, rewrite the group's local position from it every warp frame — the exact `true − worldOrigin` pattern the celestial bodies use (`main.js:6075`). Rebase is translation-only, so orientation (set by `open()`'s `lookAt`) is unaffected — only `group.position` needs the rewrite.

- [ ] **Step 1: Import the true-world helpers in main.js**

In the `WorldOrigin.js` import block (`~58-64`), add `getWorldTrue as _getWorldTrue,` and `fromWorldTrue as _fromWorldTrue,` (alongside the existing `worldOrigin as _worldOriginVec`).

- [ ] **Step 2: Add scratch vectors** (near `~1596`, by `_swapNewForward`):

```js
const _pocketAnchorTrue = new THREE.Vector3();  // pocket origin in TRUE-WORLD (rebase-proof)
const _destForward = new THREE.Vector3();        // locked post-swap flight axis
```

- [ ] **Step 3: Capture the true-world anchor + locked axis at the seam**

In `onSwapSystem`, inside `if (_useDualPortal) { ... }` (`~3011`), right after `camera.getWorldDirection(_swapNewForward);` and the `open()` call, add:

```js
    _destForward.copy(_swapNewForward);
    _getWorldTrue(camera.position, _pocketAnchorTrue);  // group origin == Portal A == camera here
```

- [ ] **Step 4: Rewrite the group from the anchor every warp frame (rebase-proof)**

In the dual-portal block, immediately BEFORE `warpPortal.updateTraversal(camera, ...)` (`~6645`), add:

```js
        // Rebase-proof pocket: anchored in TRUE-WORLD at the seam; rewrite local
        // position from the anchor every frame so the async teleport /
        // resetWorldOrigin <-> maybeRebase race can't detach it (mirrors the
        // per-frame `true - worldOrigin` body writes ~6075). Orientation is set
        // once by open(); rebase is translation-only so it stays correct.
        if (warpEffect._swapFired) {
          _fromWorldTrue(_pocketAnchorTrue, warpPortal.group.position);
        }
```

- [ ] **Step 5: Lock the post-swap advance axis (mirror entry-side Fix D)**

At `~6766`, change `const _advanceDir = warpEffect._swapFired ? _sunDir : _tunnelForward;` to use the captured locked axis:

```js
        const _advanceDir = warpEffect._swapFired ? _destForward : _tunnelForward;
```

(View still faces the star; position advances straight down the Portal B axis, so the camera stays inside the 3u gate to the crossing.)

- [ ] **Step 6: Remove the per-frame camera-follow (AC7)**

Replace the OUTSIDE_B follow block (`~6803-6815`) with just the one-time landing-strip retire — the true-world anchor (Step 4) + normal post-warp `maybeRebase` already keep the portal frozen in place; the follow fought that:

```js
      // AC7: portal frozen at its true-world exit anchor; no camera-follow.
      // (During warp it's rewritten from the anchor (Step 4); post-warp it's a
      // scene child carried by normal maybeRebase.) Just retire the
      // approach-only landing strip once emerged.
      if (warpPortal.group.visible && warpPortal._traversalMode === 'OUTSIDE_B') {
        if (warpPortal._landingStrip) warpPortal._landingStrip.visible = false;
      }
```

Grep for now-dead scratch (`_portalFollowPos`, `_portalFollowTarget`) and remove their declarations if unused. **KEEP `_arrivalForward`** (read by the lab-mode slerp at `~3071`).

- [ ] **Step 7: Headless test — relative geometry survives a rebase**

Add a test asserting: given a pocket anchored at a true-world point and Portal B at `anchor + 60·axis`, after applying a `worldOrigin` offset and recomputing `group.position = fromWorldTrue(anchor)`, the camera↔PortalB local distance is unchanged. Run `npx vitest run tests/warp-tunnel-rebase.test.js`.

- [ ] **Step 8: Live verify (GPU 9223)** — warp Sol→star; confirm post-swap `camToDiscB` stays ~60 (NOT 1730) and decreases toward 0 as the camera advances; mode reaches `OUTSIDE_B` BEFORE `onComplete`. (Emergence timing/gating finished in Task 5.)

- [ ] **Step 9: Commit**

```bash
git add src/main.js tests/warp-tunnel-rebase.test.js
git commit -m "feat(warp): rebase-proof true-world-anchored pocket + locked exit axis (AC4/AC7)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Load-adaptive emergence — gate (AC5) + shader pre-compile (AC9) + crossing-drives-EXIT (AC4 timing)

**Files:**
- Modify: `src/effects/WarpEffect.js` (`HYPER_MIN_CRUISE`, `destinationReady`, the HYPER→EXIT trigger ~272-281)
- Modify: `src/main.js` (`onSwapSystem`: `await compileAsync` then set `destinationReady`; warp camera-advance clamp ~6753-6767; wire the OUTSIDE_B crossing → `state='exit'`)
- Test: `tests/warp-tunnel-rebase.test.js` (AC5 gate)

> Reconciles AC4 (real geometric crossing) with AC5 (cruise that extends on slow load). Mechanism: the camera cruises forward; its advance is **clamped just short of Portal B** until the gate opens (`elapsed ≥ HYPER_MIN_CRUISE && destinationReady`); on open it crosses → real `INSIDE→OUTSIDE_B` emergence → that crossing drives HYPER→EXIT. `destinationReady` flips only after `spawnSystem` **and** the destination shaders are pre-compiled (AC9), so the 324ms first-render hitch is pre-paid during the occluded cruise.

- [ ] **Step 1: Failing AC5 test** — add the gate test (late-resolving `destinationReady` extends cruise past min; early-resolving lasts exactly min):

```js
import { WarpEffect } from '../src/effects/WarpEffect.js';
describe('load-adaptive emergence gate (AC5)', () => {
  function runHyper(we, { readyAt, dt = 0.1, maxT = 30 }) {
    we.state = 'hyper'; we.elapsed = 0; we.destinationReady = false;
    let t = 0;
    while (we.state === 'hyper' && t < maxT) { t += dt; if (t >= readyAt) we.destinationReady = true; we.update(dt); }
    return t;
  }
  test('slow load extends cruise past the minimum', () => {
    const we = new WarpEffect(); const min = we.HYPER_MIN_CRUISE;
    expect(runHyper(we, { readyAt: min + 2.0 })).toBeGreaterThan(min + 1.9);
  });
  test('fast load: cruise lasts ~exactly the minimum', () => {
    const we = new WarpEffect(); const min = we.HYPER_MIN_CRUISE;
    const t = runHyper(we, { readyAt: 0.05 });
    expect(t).toBeGreaterThanOrEqual(min); expect(t).toBeLessThan(min + 0.25);
  });
});
```

Run `npx vitest run tests/warp-tunnel-rebase.test.js -t "load-adaptive"` → FAIL (`HYPER_MIN_CRUISE` undefined).

- [ ] **Step 2: WarpEffect gate** — constructor: `this.HYPER_MIN_CRUISE = 3.5; this.destinationReady = false;`; reset `destinationReady = false` in `start()`. In `_updateHyper` replace the `if (this.elapsed >= this.HYPER_DUR) { ... }` (~278) with:

```js
    // Load-adaptive: leave HYPER only when the min cruise elapsed AND the
    // destination is ready. (Also force-exit if the geometric emergence already
    // flipped OUTSIDE_B — see main.js crossing->exit wiring.)
    if (this.elapsed >= this.HYPER_MIN_CRUISE && this.destinationReady) {
      this.state = 'exit'; this.elapsed = 0;
    }
```

(Keep a high safety ceiling so a never-ready load can't hang HYPER forever — e.g. `|| this.elapsed >= this.HYPER_DUR * 4`.)

- [ ] **Step 3: AC9 pre-compile + release the gate** — in `onSwapSystem`, after `warpSwapSystem()` + the seam re-anchor + sky rebuild, add:

```js
  // AC9: pre-pay the destination's first-render shader compile during the
  // occluded cruise (three 0.183 compileAsync -> Promise). Release the AC5
  // emergence gate only once spawn AND compile are done.
  try { await retroRenderer.renderer.compileAsync(scene, camera); }
  catch (e) { console.warn('[WARP] compileAsync failed (continuing):', e); }
  warpEffect.destinationReady = true;
```

(Confirm `scene` + `retroRenderer.renderer` are in scope — `retroRenderer.renderer.compile(scene, camera)` is already used at `main.js:8700`.)

- [ ] **Step 4: Clamp the camera short of Portal B until the gate opens** — in the warp camera-advance block (`~6753-6767`), gate the post-swap forward step on `elapsed ≥ HYPER_MIN_CRUISE && destinationReady`; while closed, cap the advance so axis-distance-to-Portal-B stays ≥ ~0.5u (compute from `warpPortal._discB` world pos vs camera along `_destForward`). When open, advance freely → camera crosses → `updateTraversal` flips `OUTSIDE_B`.

- [ ] **Step 5: Crossing drives EXIT** — where `warpPortal.onTraversal`/the INSIDE handler lives (`main.js:~1614`), add: on `mode === 'OUTSIDE_B'` during HYPER, set `warpEffect.state = 'exit'; warpEffect.elapsed = 0;` so emergence ends the cruise (instead of the timer).

- [ ] **Step 6: Run tests** (`npx vitest run`) → all green. **Step 7: Live verify** — fast load emerges at ~min-cruise; an artificially delayed `destinationReady` extends the cruise (camera holds just inside Portal B), then emerges. **Step 8: Commit**

```bash
git add src/effects/WarpEffect.js src/main.js tests/warp-tunnel-rebase.test.js
git commit -m "feat(warp): load-adaptive emergence gate + shader pre-compile + crossing-drives-exit (AC5/AC9/AC4)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Portal close-tween (AC8)

**Files:**
- Modify: `src/effects/WarpPortal.js` (REVERT the `:718` tunnel-hide stopgap; add `uFade` uniform + `transparent:true` to the tunnel material + alpha multiply in its frag shader; add `startClose()` / `updateClose(dt)`)
- Modify: `src/main.js` (start the tween at the OUTSIDE_B crossing; drive `updateClose(dt)` each frame through the post-warp coast)
- Test: `tests/warp-tunnel-rebase.test.js` (UPDATE the existing `makeFakePortal` `.call()` visibility-lifecycle tests → tween behavior)

> Starting at the emergence crossing, the tunnel + ring shrink and fade over ~3s, then disappear — tunnel stays VISIBLE the whole close so a look-back shows it closing, not gone. Reverts the uncommitted force-hide.

- [ ] **Step 1: Revert the stopgap** — in `setTraversalMode` (`WarpPortal.js:718`) delete `this._tunnel.visible = (mode !== 'OUTSIDE_B');` (tunnel stays visible on OUTSIDE_B; the tween hides it). **Keep** the `resetTraversal` re-show at `:881`.

- [ ] **Step 2: Tunnel fade lever** — the tunnel `ShaderMaterial` (`:126-147`) is opaque with no alpha lever. Add `transparent: true` and a `uFade: { value: 1 }` uniform; in its fragment shader multiply the output alpha by `uFade` at the final `gl_FragColor`. Add `setTunnelFade(v)` (`this._tunnel.material.uniforms.uFade.value = v`).

- [ ] **Step 3: Close-tween API** — add to WarpPortal:

```js
  startClose() { this._closing = true; this._closeT = 0; }
  updateClose(dt) {
    if (!this._closing) return;
    this._closeT += dt;
    const CLOSE_DUR = 3.0;
    const t = Math.min(1, this._closeT / CLOSE_DUR);
    this.setRadius(this._radius * (1 - t));
    this.setRimIntensity(Math.max(0, 1 - t));
    this.setTunnelFade(1 - t);
    if (t >= 1) { this._closing = false; this.close(); }   // close() hides the group
  }
```

(Init `this._closing = false` in the constructor; clear it in `resetTraversal` + restore `setTunnelFade(1)`, `setRadius(this._radius)`.)

- [ ] **Step 4: Trigger + drive** — start the tween at the `INSIDE→OUTSIDE_B` crossing (in the same `onTraversal` handler as Task 5 Step 5: `warpPortal.startClose()`). Drive `warpPortal.updateClose(deltaTime)` every frame while `warpPortal._closing` — in BOTH the warp block and the post-warp `else` branch (the close spans EXIT + the start of free flight). Remove the forced `setTraversalMode('OUTSIDE_B')` at `onComplete:3061` (emergence is now a real crossing; replace with a warn-only fallback if still INSIDE at onComplete).

- [ ] **Step 5: Update the makeFakePortal tests** — the current uncommitted tests assert `_tunnel.visible === false` on OUTSIDE_B (the stopgap). Rewrite to: OUTSIDE_B leaves the tunnel visible; `updateClose` drives radius/rim/fade monotonically to ~0 over 3s; only at completion does `close()` hide the group; `resetTraversal` restores fade/radius/visibility. Add `setTunnelFade`/`_tunnel.material.uniforms.uFade` to `makeFakeNode`/`makeFakePortal`.

- [ ] **Step 6: tests green; Step 7: live verify** (radius/rim/fade fall to ~0 over ~3s, tunnel visible until close, look-back shows it closing); **Step 8: Commit**

```bash
git add src/effects/WarpPortal.js src/main.js tests/warp-tunnel-rebase.test.js
git commit -m "feat(warp): portal close-tween on emergence — shrink+fade over 3s (AC8)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Swap-occlusion invariant (AC10) + live verification + docs

**Files:**
- Modify: `src/main.js` or `src/effects/WarpEffect.js` (AC10 runtime assertion at the swap)
- Create/Use: an exit-side live harness (rebuild the session probe) in `src/debug/`
- Modify: `docs/FEATURES/warp.md`, `docs/NOW.md`

> Headless gates (AC2/AC4-math/AC5) are green from Tasks 1/4/5/6. AC1/AC3/AC4/AC7/AC8/AC9/AC10 are live-integration. Note `runWarpEntrySuite` is entry-only — the exit side is new ground.

- [ ] **Step 1: AC10 invariant** — at the `onSwapSystem` swap point, assert `warpPortal._traversalMode === 'INSIDE' && warpPortal._tunnel.visible === true && <camera inside tunnel interior>`. On violation, `console.error('[WARP][AC10] swap exposed!', ...)` (loud, so a future camera/movement change that exposes the ~3000u teleport fails visibly). Assert headlessly too if the swap trigger is pure.

- [ ] **Step 2: AC1/AC3** — `window.__wd.runRepeatWarpSuite()` + a manual ≥8-warp chain (repeats + far target): every HYPER frame has `effect.warp.tunnel` present + inFrustum, mode reaches INSIDE, zero black HYPER; axis-distance monotonic, `camForward·axis > 0`.

- [ ] **Step 3: AC4/AC7/AC8/AC9/AC10 live** (rebuild the session probe): AC4 `OUTSIDE_B` before `onComplete` (no warn); AC7 portal world-true (`getWorldTrue(group.position)`) constant across the coast while camera→portal distance grows; AC8 radius/rim/fade monotonic to ~0, tunnel visible until close; **AC9 on a COLD first warp of a fresh page load** no frame >~50ms in swap→emergence; AC10 invariant holds.

- [ ] **Step 4: Headless suite** `npx vitest run` → green. **Step 5: Docs** — `docs/FEATURES/warp.md` (mechanism = rebase-proof pocket fly-through, load-adaptive HYPER, close-tween arrival), `docs/NOW.md` (workstream → VERIFIED_PENDING_MAX). `npm run doc-rot` clean. (NOTE: `docs/NOW.md` has unrelated uncommitted planet-lab edits — coordinate with Max before editing/committing it.)

- [ ] **Step 6: verify-workstream** (full):

```
Workflow({scriptPath:"/home/ax/projects/personal-os-improvements/dev-collab/workflows/verify-workstream.mjs",
  args:{contractPath:"docs/WORKSTREAMS/warp-tunnel-pocket-traversal-2026-06-06/contract.json", mode:"full", commit:"<sha>", liveBranch:"master"}})
```

AC1-AC5/AC7-AC10 PASS, AC6 `deferred-to-max` → set workstream `VERIFIED_PENDING_MAX <sha>` → Max UAT.

- [ ] **Step 7: Commit docs.**

---

## Self-review notes (2026-06-07 rewrite)

- **AC coverage:** AC1→T7.2; AC2→done (T1, verified live); AC3→T7.2; **AC4→T4 (rebase-proof reachability) + T5 (gated timing) + T6 Step 4 (remove forced flip)**; AC5→T5; AC6→Max UAT after T7; AC7→T4 (anchor + remove follow); AC8→T6; AC9→T5 Step 3; AC10→T7.1.
- **Root-cause correction is load-bearing:** the original T4 ("place Portal B ahead") was necessary-but-insufficient — placement is already correct; the teleport+rebase race is the bug. T4 now fixes the race; do NOT revert to the old framing.
- **Known follow-ups (NOT in scope here):** `exitPeakSpeed = 6.7e-7` is stale (file its own cleanup); FOLD-phase 150–255ms gen stutters (`onPrepareSystem` main-thread gen — separate workstream, time-slice/worker); AC9 is cold-shader-only (intermittent).
- **Risk to flag to Max:** the AC5 "clamp camera short until gate" (T5 Step 4) is the one piece with felt-experience implications (a slow load = a brief hold at the portal mouth before emerging). Tune live; AC6 is Max's gate.

