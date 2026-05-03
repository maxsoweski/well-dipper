# Rebase × Celestial-Motion Interaction — Root-Cause Analysis (2026-05-03)

## Bug

Visible jittering of planets while autopilot CRUISE is active. Camera
intermittently ends up inside or coincident with the target body
(visible as solid color / gradient screen-fill). Reported by Max while
watching working-Claude run the motion-test-kit dogfood.

## Root cause

**`worldOrigin` rebasing and the realistic-celestial-motion per-frame
position writes are not reconciled.** Each frame, the body update math
overwrites the rebase shift, leaving camera and bodies in inconsistent
coordinate frames between rebase events.

### Mechanism

1. `WorldOrigin.maybeRebase()` (`src/core/WorldOrigin.js:136-154`) fires
   when `camera.position.lengthSq() ≥ 100²`. It:
   - Captures camera position as `offset`
   - Resets `camera.position` to `(0,0,0)`
   - Iterates `scene.children`, subtracts `offset` from each
   - Notifies tracked Vector3s + listeners
2. Bodies' meshes ARE top-level scene children — verified by live
   probe: `tgt.parent === window._scene` returned `true`.
3. The rebase SHIFT IS APPLIED to body meshes correctly during step 1.
4. But the *next* animate-loop frame, `Planet`/`Moon`/star orbital
   updates execute BEFORE the next `maybeRebase()` call. Each writes
   `mesh.position.set(absX, absY, absZ)` using **absolute world
   coordinates** (origin = star at world (0,0,0), or
   parentPosition+orbital for moons).
5. These writes **overwrite the rebase shift** — the body's mesh
   returns to its un-rebased absolute coordinates.
6. Camera stays at `(0,0,0)` post-rebase; bodies are now at absolute
   world coords; relative geometry is broken until the next rebase
   event re-shifts the bodies (which is then overwritten again).

### Sites

| Site | What it writes |
|------|----------------|
| `src/main.js:5998-6003` | Binary star pair orbital positions |
| `src/main.js:6011` | Planet orbital positions |
| `src/main.js:6033-6041` (planet-class moons) | Special-case moons whose orbit is computed in main.js, not Moon.js |
| `src/objects/Moon.js:589` | Standard moon orbital positions |

Each writes `mesh.position.set(absoluteX, absoluteY, absoluteZ)` where
"absolute" means the un-rebased world frame (star at origin).

## Evidence

### Frame 67 — first violation in the dogfood capture

| Frame | Cam pos | Tgt pos | Distance |
|-------|---------|---------|----------|
| 65 | [25.29, 0, 96.68] | [385.69, 0, 1474.40] | 1424.08 |
| 66 | [25.57, 0, 97.76] | [385.69, 0, 1474.40] | 1422.97 |
| **67** | **[0.27, 0, 1.05]** | **[385.69, 0, 1474.40]** | **1522.93** |
| 68 | [0.55, 0, 2.09] | [385.69, 0, 1474.40] | 1521.85 |

Camera coordinates dropped ~99 units in one frame (clearly a rebase —
camera magnitude was >97 going into frame 66, post-rebase reset to
near-origin). Target position UNCHANGED (rebase failed to propagate
through the body's per-frame orbital write).

### Periodic pattern across the capture

145 `approachPhaseInvariant` violations across 5914 samples. First 10
largest distance jumps:

| Frame | distDelta | distNow | Note |
|-------|-----------|---------|------|
| 4250 | 1523.91 | 1524.11 | STATION arrival event (fixed-camera at the body) |
| 67 | 99.96 | 1522.93 | First rebase event |
| 522 | 99.17 | 1522.99 | Subsequent rebase |
| 977 | 99.06 | 1522.93 | … |
| 795 | 99.01 | 1522.91 | … |
| 249 | 98.98 | 1522.91 | … |
| 340 | 98.98 | 1522.91 | … |
| 886 | 98.98 | 1522.91 | … |
| 158 | 98.98 | 1522.91 | … |
| 1068 | 98.98 | 1522.93 | … |

All non-STATION jumps are ~99 units = `√(REBASE_THRESHOLD_SQ)` = 100.
Periodic firing of rebase events at the threshold boundary.

### Body motion confirms bodies aren't moving relative to absolute
coords across the capture

Live probe: `autopilotMotion._target.position` over 1 second of
wall-clock = `[0, 0, 0]` delta. Bodies are essentially static in
absolute coords at this celestial-time multiplier. They're being
re-written to the same absolute coords every frame, which is what
makes the rebase failure visible.

## Visible consequences

**Jitter:** camera position resets to origin on rebase; body positions
are written back to un-rebased absolute coords each frame. The relative
geometry rendered each frame jumps discontinuously every ~91 frames at
240 Hz capture rate (matches rebase-fire cadence given autopilot CRUISE
speed at moon scale).

**Camera-inside-body:** autopilot's pursuit math reads `bodyPos`
(absolute coords, post-overwrite) and computes distance from its
internal `_position` (which may be in either frame depending on rebase
timing). The miscomputed distance accumulates pursuit error; by the
time the autopilot transitions out of CRUISE, the camera can end up
coincident with the body (`distance = 0` in the dogfood's last
samples).

## Fix shape

Each absolute-coord write needs to subtract `worldOrigin` before
storing into mesh.position:

```js
import { worldOrigin } from '../core/WorldOrigin.js';

// Inline at each site:
entry.planet.mesh.position.set(
  px - worldOrigin.x,
  -worldOrigin.y,
  pz - worldOrigin.z,
);
```

Or use the existing `fromWorldTrue` helper:

```js
import { fromWorldTrue } from '../core/WorldOrigin.js';
const _scratch = new THREE.Vector3();

fromWorldTrue(_scratch.set(absX, absY, absZ), entry.planet.mesh.position);
```

## Verification path

The motion-test-kit's `approachPhaseInvariant` is the regression gate:

```js
// Pre-fix (current): 145 violations
const r = approachPhaseInvariant(samples, { phaseStart: 0, phaseEnd: samples.length, eps: 0.5 });
// Post-fix expectation: 0 violations (or small-N if there are real
// pursuit overshoots distinct from rebase artifacts)
```

Same scenario, same capture protocol. Worth ALSO running the relative
predicates (anchor − target deltas) to confirm rebase events stop
showing as discontinuities.

## Captured artifacts

- `dogfood-samples-v2-slim.json` (~2 MB, 5914 samples) — the capture
  this analysis is built on. Slim format: kit-relevant fields only
  (frame, t, dt, anchor, target, state), no heavy bodies/perBody arrays.
- This file (`ANALYSIS.md`).

## Workstream context

Surfaced by the motion-test-kit dogfood (AC #23 of
`docs/WORKSTREAMS/motion-test-kit-2026-05-02.md`). The kit's
`approachPhaseInvariant` predicate flagged the bug class that the
toggle-fix workstream's coarse 3-point sampling missed and that Max's
visual review caught. **This is the kit's first production bug catch
— validates the kit's value proposition.**

Out of scope for the kit workstream and the toggle-fix workstream;
needs its own scope. Fix sites are well-defined (4 places); verification
is a kit-predicate run; expected workstream size is small (~half-day
including Tester verdict).
