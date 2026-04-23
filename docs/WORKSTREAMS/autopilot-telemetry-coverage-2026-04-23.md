# Workstream: Autopilot telemetry coverage — programmatic backfill for WS 3 camera-axis + shake-redesign AC #19 (2026-04-23)

## Status

`Drafted — pending WS 3 Shipped + Director audit.` Gate state is deferred:
`autopilot-camera-axis-retirement-2026-04-23` remains the active-workstream
in `~/.claude/state/dev-collab/` until Max flips WS 3 to Shipped against
the existing recording (`screenshots/max-recordings/autopilot-camera-axis-retirement-2026-04-23.webm`).
This brief ships at draft so Director can audit as soon as WS 3 closes;
the `active-workstream` pointer flips on the Director audit that greenlights
execution, not on this commit.

**Why draft-commit (not full scope) right now.** Retroactive verification
against a shipped baseline is meaningful only *after* Max has accepted
the baseline. If Max rejects WS 3 on his own review, the recording is no
longer the baseline to backfill against, and this brief's retroactive-
verification plan is moot. Draft-committing now preserves the scope
articulation (and the Director's specification of the four invariants)
without committing to execution before the precondition holds.

## Revision history

- **2026-04-23 — drafted** by PM in response to Max's question *"why
  don't we have telemetry systems that can verify some of this?"*
  during WS 3 review. Director owned the miss (both PM and Director
  co-authored/audited WS 3 ACs #4/#5/#6 as felt-experience-only
  rather than encoding them as frame-level invariants the way shake-
  redesign ACs #16–20 were encoded). Director recommended the
  hybrid: ship WS 3 on Max's eyeball review, scope this workstream
  now, backfill programmatic coverage so the next camera-axis
  change-set (SHOWCASE authoring, per-body ESTABLISHING tuning, etc.)
  has a gate that isn't "re-shoot the recording." Max greenlit the
  hybrid; this is the scoping half.

## Parent feature

**`docs/FEATURES/autopilot.md`** — Director-authored 2026-04-20 at
commit `bdeb0ff`, keybinding update at `4b9b18a`, parking-lot entry
at `79cdf4e`, WS 3 Workstreams-list entry at `a1019da`.

This workstream does **not** add new feature criteria. Its entire
purpose is to encode existing feature criteria (shipped under WS 3 + shake-
redesign) as programmatic invariants on top of the same telemetry
sample buffer the shake redesign built, so future camera-axis changes
have a regression gate that doesn't require Max to re-watch a full tour
recording every iteration.

Specific sections this workstream indirectly serves (by making their
already-authored criteria continuously testable):

- **§"Per-phase criterion — camera axis (V1)" — `ESTABLISHING`** —
  the three authored criteria (independent pacing, linger on receding
  subjects, pan-forward toward incoming targets). WS 3 ACs #4, #5, #6
  verified these against Max's eyeball review of the 60s Sol tour;
  this workstream backfills the programmatic invariants so the next
  change-set can re-verify without a recording.
- **§"Drift risks" #1 — Re-coupling ship + camera axes** — the
  programmatic `independentPacing` audit detects the anti-pattern
  directly (camera-transition timestamps tracking ship-phase-
  transition timestamps with zero divergence = re-coupling
  regressed in).
- **§"Gravity drives — ship-body shake on abrupt transitions"** —
  the shake-redesign brief listed a pinned-star pixel invariant
  (AC #19 surface-invariant) that was closed as **code-grep**
  only ("only documentation comments reference `camera.position`
  in the shake context; no code path writes to it"). The two-frame
  pixel check this workstream adds upgrades that invariant from
  grep-only to runtime-observable — catches future regressions
  where a shake code path does mutate `camera.position` at runtime
  even if the grep passes (e.g., a composed surface that indirectly
  writes position through an intermediate system).

Primary contract anchors:

- **`docs/SYSTEM_CONTRACTS.md` §10.7 Audio event-surface hook** —
  the `camera-mode-change` event exists in the autopilot event-
  surface in V1 with zero subscribers. The `independentPacing`
  audit consumes the same phase/mode-transition timestamps the event
  surface emits; the audit is a V1 internal subscriber to its own
  emission stream, not a new external surface.
- **`docs/SYSTEM_CONTRACTS.md` §10.9 OOI query interface (stub in
  V1)** — the stub-usage invariant is "`getNearbyOOIs` /
  `getActiveEvents` are called from SHOWCASE / ROVING dispatch
  branches even though they return empty in V1." This workstream
  does NOT add a stub-call-count audit (WS 3's grep-level AC #7
  covers that); it is named here because the new telemetry
  extensions (framing state, mode, body-ref snapshots) share the
  same sample-buffer pipeline the §10.9 dispatch routes through.
- **Out-of-scope contract:** §5 Camera and Control is orthogonal.
  This workstream does not touch manual/autopilot orthogonality;
  it audits autopilot-internal state only.

## Implementation plan

N/A (workstream-sized). All four audit helpers fit inside the
existing `window._autopilot.telemetry.audit.*` namespace in
`src/main.js` (~50–80 lines each, shape already established by
shake-redesign's four helpers). Telemetry sample-shape extensions
(framing state, `lookAtTarget` snapshot, `bodyRef.position` /
`nextBodyRef.position` snapshots, `cameraMode`) are single-line
pushes into the existing `_captureTelemetrySample()` function. No
new module seam; no cross-system state machine. If mid-work
working-Claude discovers the pinned-star pixel check requires
a dedicated capture-harness module, escalate to PM for a PLAN
bootstrap rather than expanding this brief.

## Scope statement

Backfill **programmatic telemetry invariants** for WS 3 camera-axis
ACs #4 / #5 / #6 (independent pacing, linger on receding subject,
pan-ahead bias) and for the shake-redesign pinned-star pixel
invariant (named as AC #19 in the shake brief but closed as
code-grep only). Model after the shake-redesign audit pattern
(`window._autopilot.telemetry.audit.*` helpers; each takes an
optional samples array and returns `{ passed, violations, totalSamples }`).
Verify WS 3's shipped behavior retroactively against the existing
WS 3 recording (or a fresh deterministic capture if the existing
recording's seed / camera state is insufficient for the pixel check).
Become the **future-regression gate** for any code change that
touches `src/auto/CameraChoreographer.js`, the `EstablishingMode`
dispatch, or the `FlythroughCamera`-to-choreographer wiring.

This includes:

- **Telemetry sample-shape extensions** in `_captureTelemetrySample()`
  (`src/main.js` L625–683): add `cameraMode` (from
  `cameraChoreographer.currentMode`), `framingState` (from
  `cameraChoreographer.framingState`), `lookAtTarget` as
  `[x,y,z]` snapshot (from `cameraChoreographer.currentLookAtTarget`),
  `navBodyPos` snapshot (from `navSubsystem.bodyRef?.position`),
  `navNextBodyPos` snapshot (from `navSubsystem.nextBodyRef?.position`),
  `shipPhase` is already in samples, `navPhase` is already in samples.
- **Four new audit helpers** at `window._autopilot.telemetry.audit.*`,
  each returning `{ passed: boolean, violations: Array, totalSamples: number }`:
  1. `lingerTargetCorrect(samples)` — AC for WS 3 #5 retroactive.
  2. `independentPacing(samples)` — AC for WS 3 #4 retroactive.
  3. `panAheadBias(samples)` — AC for WS 3 #6 retroactive.
  4. `pinnedStarPixelStable(frameA, frameB, options)` — AC for
     shake-redesign #19 runtime upgrade. Different signature (takes
     two captured frames, not a samples array) because the check
     is pixel-diff on canvas output, not invariant-over-samples.
- **`runAllCameraAxis(samples)` convenience** — analog of the shake
  `runAll()` at L606–620: calls the three sample-based audits and
  returns a combined `{ passed, ac4_independentPacing, ac5_lingerTargetCorrect, ac6_panAheadBias, totalSamples }` report. Pixel-stable is
  excluded from `runAllCameraAxis` because it needs the two-frame
  capture harness, not the sample buffer.
- **Retroactive verification** — run the existing WS 3 Sol tour
  under telemetry capture; assert all three sample-based audits
  pass against the behavior the Shipped baseline produced. If any
  audit fails on the shipped baseline, the audit logic is wrong
  (not the WS 3 code) — iterate on the audit; do NOT regress WS 3.
- **Pinned-star pixel-check harness** — a small helper that runs
  against the live canvas (same pattern as `~/.claude/helpers/filmstrip.js`
  or the canvas recorder). Captures frame A, triggers a debug shake
  event, captures frame B mid-shake, compares pixel positions of a
  known fixed-direction background star across the two frames.
  Sub-pixel displacement threshold = pass (rotation-only shake
  holds); >1px displacement = fail (shake is leaking into translation).

Camera-to-shake composition stays untouched — this workstream adds
**observers**, not **behavior** changes. No code path that currently
writes to `camera.position`, `camera.quaternion`, or `_lookAtTarget`
is modified. If mid-work a telemetry sample requires a new computation
inside one of those code paths (rather than a read-only capture), stop
and escalate — that's a scope inversion.

**One unit of work** because the four audits form a coherent coverage
package: shipping three camera-axis audits without the pinned-star
pixel check would leave shake-redesign's AC #19 at "code-grep only"
indefinitely (nobody comes back to close a gap that's nominally
closed); shipping just the pixel check without the camera-axis
audits doesn't address Max's actual question (*"why don't we have
telemetry systems that can verify some of this?"* — "this" was
WS 3's camera-axis ACs, not AC #19). Director's specification
bundled them deliberately.

**Explicitly NOT a license to rewrite WS 3 ACs.** The authored
`LINGER_DURATION = 1.8s` and `PAN_AHEAD_FRACTION = 0.35` remain
**tuning questions within programmatic spec** (Director's framing).
The invariants this workstream encodes are the *shape* (linger holds
the receding body's position; pan-ahead target projects positively
onto the next-body direction); the *magnitudes* (1.8s, 0.35) stay
in the tunable surface at the top of `CameraChoreographer.js` and
are Max's eye to call.

## How it fits the bigger picture

Advances `docs/GAME_BIBLE.md` §11 Development Philosophy:

- **Principle 6 — First Principles Over Patches.** The first-
  principles shape of a camera-axis regression gate is *"the
  invariants that define ESTABLISHING's authored behavior are
  encoded as frame-level assertions on the same telemetry
  buffer that the shake mechanism already uses for regression
  coverage."* The patch move is "re-shoot the recording each
  time." The patch ships V1 and compounds Max-time cost across
  V-later (SHOWCASE authoring, per-body tuning, per-spectral-
  class framing — each would otherwise demand its own recording
  review against regression of WS 3 behavior). The first-
  principles move ships a one-time cost and makes future change-
  sets' regression-check a one-line `runAllCameraAxis()` call.
  *Violation in this workstream would look like:* writing the
  audits against symptom-class observations ("no black frames in
  the recording," "framingState is not `TRACKING` for every
  frame") rather than feature-criteria-verbatim invariants
  (linger target = previous body position; pan-ahead projection
  is positive). The Director called this out during the WS 3 AC
  authoring and is the single biggest risk to avoid here.
- **Principle 2 — No Tack-On Systems.** The telemetry sample
  buffer is load-bearing shared infrastructure — shake redesign
  already uses it, WS 3 already uses it for `shipPhase` and
  `navPhase`, future camera-axis work inherits it. The failure
  mode this workstream guards against is the "we'll add a
  separate test harness when we need camera-axis regression
  coverage" tack-on: a new buffer, a new capture lifecycle, a
  new reporting shape. Everything this workstream adds lands in
  `_captureTelemetrySample()` and the existing
  `window._autopilot.telemetry.audit.*` namespace — same pipeline,
  extended coverage.

Advances `docs/GAME_BIBLE.md` §1 Vision / Core Experience
indirectly — by making the Discover axis's cinematographer-
composition criteria (linger, pan-ahead, independent pacing)
continuously regression-testable, the cost of iterating on
SHOWCASE / per-body / per-spectral-class framing drops, which
is what accelerates reaching "every system is different" with
consistent cinematographic quality.

## Acceptance criteria

Contract-shaped per `docs/PERSONAS/pm.md` §"Per-phase AC rule
carve-out: process / tooling workstreams." This is a telemetry /
tooling workstream — it adds observers on top of existing feature
behavior, does not author new user-visible phases — so ACs cite
the deliverable's interface + a verifiable observation rather
than quoting feature-doc phase sections verbatim. ACs #1–#4
model after shake-redesign ACs #16–20 (see `src/main.js` L482–620
for reference shape).

1. **`lingerTargetCorrect(samples)` audit exists and retroactively
   passes against WS 3 Sol tour.** Per the WS 3 AC #5 criterion
   (*"camera remains framed on the planet the ship just left …
   for a visible beat after the ship has begun its CRUISE motion
   toward the next body"*) plus feature-doc §"`ESTABLISHING`"
   linger clause. Verified by:
   - `window._autopilot.telemetry.audit.lingerTargetCorrect(samples)`
     is callable; returns `{ passed: boolean, violations: Array,
     totalSamples: number }`.
   - For every sample with `framingState === 'LINGERING'`:
     - `|lookAtTarget − previousStationBodyPos| < EPS_NEAR` (target
       pins to the receding body, NOT drifting toward the new
       motion frame's `lookAtTarget`).
     - `|lookAtTarget − navNextBodyPos| > EPS_FAR` (target is
       demonstrably NOT on the incoming target; a frame where
       those two coincide would mean the linger collapsed early
       or the test is on a degenerate leg).
     - `lingerElapsed < LINGER_DURATION + EPS_TIME` (linger does
       not exceed its authored duration — catches a bug where
       framingState fails to transition back to `TRACKING`).
   - `previousStationBodyPos` is derived by walking backward from
     the LINGERING sample to find the last sample with `shipPhase
     === 'STATION'`, reading its `navBodyPos`.
   - `EPS_NEAR`, `EPS_FAR`, `EPS_TIME` are constants at the top of
     the audit helper, tunable if the ship-motion drift (STATION
     body position changes slightly as the ship leaves orbit)
     proves to need a wider band. Sensible starting values: 5.0
     world-units (positions are in a normalized scene), 20.0,
     0.05s.
   - **Retroactive check:** run the audit against a fresh Sol
     tour telemetry capture (using the WS 3 `d` shortcut flow);
     assert `passed === true`. If `passed === false`, the audit
     is wrong (WS 3 baseline is frozen Shipped); iterate the
     audit thresholds / logic, do NOT modify
     `CameraChoreographer.js`.

2. **`independentPacing(samples)` audit exists and retroactively
   passes against WS 3 Sol tour.** Per WS 3 AC #4 (*"camera's
   framing-decision timestamp … is NOT identical to the ship-
   phase-transition frame for every ship-phase boundary"*) plus
   feature-doc §"Drift risks" #1 on re-coupling. Verified by:
   - `window._autopilot.telemetry.audit.independentPacing(samples)`
     is callable; returns the standard `{ passed, violations,
     totalSamples }` shape.
   - Extract phase-transition timestamps:
     - **Ship-axis transitions:** frames where `shipPhase[i] !==
       shipPhase[i-1]` (e.g., STATION → CRUISE at frame N).
     - **Camera-axis framing transitions:** frames where
       `framingState[i] !== framingState[i-1]` (e.g., TRACKING →
       LINGERING at frame M).
   - For every tour in the capture, assert that at least one
     `ship-transition / camera-transition` pair exists where the
     two timestamps differ by approximately `LINGER_DURATION`
     (±`EPS_PACING = 0.3s` tolerance). A zero-divergence capture
     (every camera transition at the same frame as a ship
     transition) indicates re-coupling regressed in.
   - Secondary assertion: the **count** of framing-state
     transitions in the capture is NOT identical to the count of
     ship-phase transitions — they're independent timelines, so
     the counts will diverge (pan-ahead engages during CRUISE
     without a ship-phase change; linger ends mid-CRUISE on its
     timer, not on a ship-phase boundary).
   - **Retroactive check:** same pattern as AC #1 — fresh Sol
     tour capture, assert `passed === true`.

3. **`panAheadBias(samples)` audit exists and retroactively passes
   against WS 3 Sol tour.** Per WS 3 AC #6 (*"camera's framing
   has panned ahead of the ship's travel vector — the next
   target is visibly more centered in the frame than the ship-
   forward vector alone would produce"*). Verified by:
   - `window._autopilot.telemetry.audit.panAheadBias(samples)`
     is callable; returns `{ passed, violations, totalSamples }`.
   - For every sample with `framingState === 'PANNING_AHEAD'`:
     - Compute the projection bias: normalize
       `(lookAtTarget − subsystemDefaultTarget)` and
       `(navNextBodyPos − subsystemDefaultTarget)`; assert
       their dot product is positive (target is biased
       *toward* the next body, not away). `subsystemDefaultTarget`
       is the motion-frame's `lookAtTarget` without pan — which
       requires exposing `motionFrame.lookAtTarget` as its own
       sample field (currently bundled into `navBodyPos` semantics;
       explicit extraction needed).
     - Assert projection magnitude ≥ `EPS_PAN_MIN = 0.05` and
       ≤ `PAN_AHEAD_FRACTION + EPS_PAN_MAX = 0.45` (band check —
       pan is engaged but not over-authored).
   - Secondary assertion: across the capture, the peak
     `panAheadBias` value observed approximately matches
     `PAN_AHEAD_FRACTION` within `EPS_PAN_PEAK = 0.05` (authored
     magnitude actually reached at least once per long leg).
   - **Retroactive check:** Sol tour capture, `passed === true`
     on baseline.

4. **`pinnedStarPixelStable(frameA, frameB, options)` harness
   exists and pixel-check passes against the live canvas during
   a debug-triggered shake event.** Per shake-redesign AC #19
   (*"surface-invariant: only documentation comments reference
   `camera.position` in the shake context; no code path writes
   to it"*) upgraded to **runtime observability**. Verified by:
   - A module (e.g., `~/.claude/helpers/pinned-star-pixel-check.js`
     or an inline harness in `src/main.js` under
     `window._autopilot.telemetry.pixelCheck.*`, name provisional)
     that:
     a) Freezes the scene (pause ship motion, disable warp) in
        a known camera orientation pointed at a bright background
        star.
     b) Captures frame A (canvas `toDataURL` or WebGL pixel
        readback of a ~100px patch around the known star
        position).
     c) Triggers a debug shake event via
        `shipChoreographer.debugImpulseAtOrbitDistance(...)` or
        the `debugArrivalAt('star')` path.
     d) Captures frame B mid-shake (t ≈ onset + 0.3s, past envelope
        ramp-in, well before envelope ramp-out).
     e) Computes the pixel centroid of the bright patch in each
        frame; asserts displacement < `PIXEL_EPS = 1.0` pixels.
   - A displacement > 1.0 pixel = shake is leaking into translation
     (either `camera.position` was mutated, or a downstream
     transform is composing shake before lookAt). Audit returns
     `{ passed: boolean, displacement: number, frameA: {x,y},
     frameB: {x,y} }`.
   - **Retroactive check:** run the harness against the current
     Shipped code (`1bb5eb2` + WS 3 `3b926aa`); assert
     displacement ≈ 0 px (code-grep AC #19 from shake-redesign
     says no code writes `camera.position`, so runtime should
     confirm).

5. **`runAllCameraAxis(samples)` combined report.** Same shape as
   shake `runAll()` at L606–620. Returns
   `{ passed, ac4_independentPacing: {...}, ac5_lingerTargetCorrect: {...},
   ac6_panAheadBias: {...}, totalSamples }`. Pixel-check is NOT
   included (different input shape); its harness is callable
   standalone.

6. **Sample-shape extensions documented inline.** The updated
   `_captureTelemetrySample()` function's JSDoc enumerates all
   new fields (`cameraMode`, `framingState`, `lookAtTarget`,
   `navBodyPos`, `navNextBodyPos`, `subsystemDefaultTarget`).
   Existing back-compat shape preserved — the shake audits
   (AC #16–20) do not read the new fields and continue to pass
   on the same captures.

7. **Retroactive verification report committed with the code.**
   A brief appendix in this workstream's `## Status` block at
   close, showing:
   - Sample count of the retroactive Sol-tour capture.
   - `runAllCameraAxis` result on that capture (all three
     camera-axis audits: `passed: true`).
   - `pinnedStarPixelStable` result on the paused-scene pixel
     harness (`displacement < 1.0 px`, `passed: true`).
   - The WS 3 recording path against which this backfill is
     cross-referenced: `screenshots/max-recordings/autopilot-camera-axis-retirement-2026-04-23.webm`.
   - Any audit thresholds (`EPS_NEAR`, `EPS_FAR`, `EPS_PAN_MIN`,
     etc.) that were tuned against the baseline capture — named
     with their final values so future change-sets know the
     tolerance band.

8. **Commits separable by concern.** At minimum two: (a)
   `feat(autopilot): telemetry sample-shape extensions for
   camera-axis coverage` (sample-shape + `lingerTargetCorrect`
   + `independentPacing` + `panAheadBias` + `runAllCameraAxis`),
   (b) `feat(autopilot): pinned-star pixel-check harness for
   shake rotation-only invariant` (the separate harness because
   its signature and lifecycle differ). Retroactive-verification
   Status-block update in this brief may be a third commit or
   fold into (b).

## Principles that apply

Three of the six from `docs/GAME_BIBLE.md` §11 are load-bearing
here. Principles 1, 3, 4 are orthogonal (telemetry doesn't touch
the hash grid, per-object rendering aesthetic, or BPM sync).

- **Principle 6 — First Principles Over Patches.** Named above.
  The structural move is to encode the feature's authored invariants
  as assertions; the patch is to re-watch recordings. This brief's
  biggest risk is **symptom-shaped audits** — audits that pass
  when the code is broken because they only test "something
  happened" rather than "the authored thing happened." Shake
  AC #17 `signalCoincidence` is the reference for getting this
  right: it doesn't assert "shake happened during TRAVELING"
  (symptom); it asserts "when shakeActive is true, the smoothed
  signal must have been above threshold within a bounded window"
  (criterion). The camera-axis audits must land at that level
  of criterion-specificity. *Violation in this workstream would
  look like:* `lingerTargetCorrect` whose only check is
  `framingState === 'LINGERING' implies shipPhase === 'CRUISE'`
  — that's a state-machine-internal-consistency check, not a
  feature-criterion check. The feature-criterion check is that
  the *target position* pins to the *receding body*, which
  requires reading the body-position snapshot and doing the
  distance comparison.

- **Principle 2 — No Tack-On Systems.** Named above. Everything
  in this brief lands inside the existing `window._autopilot.telemetry.*`
  surface. The only exception is the pixel-check harness, which
  differs in input shape (two frames, not a samples array);
  even that lands as a sibling under `window._autopilot.telemetry.pixelCheck.*`,
  not as a separate top-level namespace. *Violation in this
  workstream would look like:* adding a new `CameraAuditEngine`
  module with its own lifecycle, buffer, and reporting surface.

- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes.** Telemetry is strictly a **read-side observer** on
  the pipeline. The audits consume `cameraChoreographer` state
  and `navSubsystem` state; they do NOT drive either. If a
  telemetry audit decision affects what the camera does (e.g.,
  "if the audit would fail, suppress the camera update"), that
  is a reverse flow and a Principle 5 violation. *Violation in
  this workstream would look like:* `_captureTelemetrySample`
  mutating any field on `cameraChoreographer` or `navSubsystem`
  during sampling. The function is read-only.

## Drift risks

- **Risk: Symptom-shaped audits that pass while the authored
  behavior regresses.** The Director-owned miss that produced
  this workstream was the WS 3 ACs being authored as felt-
  experience-only — the question *"encode as frame-level
  invariant"* didn't land during AC drafting. The mirror risk
  here is writing camera-axis audits at symptom altitude rather
  than criterion altitude. The feature criterion for AC #5's
  linger is *"framed on the planet the ship just left"* —
  programmatically that's *"target position pins to the receding
  body's position, within a small tolerance"*. An audit that
  only checks `framingState === 'LINGERING'` for some non-zero
  duration passes if the code sets `framingState = LINGERING`
  but copies the wrong body's position into `_currentLookAtTarget`
  (e.g., `nav.nextBodyRef.position` by accident — pan-ahead bug
  bleeding into linger branch). The symptom audit passes, the
  feature regresses.
  **Why it happens:** symptom audits are ~30% the lines of
  criterion audits (no body-position snapshot extraction, no
  receding-body-detection walk-backward, no tolerance band).
  The shorter audit feels cleaner and "covers" the same AC.
  **Guard:** AC #1 / #2 / #3 each specify the *criterion-level*
  invariant (target pins to body position; timestamps diverge
  by ~`LINGER_DURATION`; projection is positive and magnitude is
  in band). Diff review: if the audit body doesn't compute a
  distance or a projection, it's symptom-shaped — escalate to
  Director.

- **Risk: Retroactive verification failures get "fixed" by
  modifying WS 3 code.** The retroactive pass against the WS 3
  Shipped baseline is the load-bearing validation step — it
  proves the audits encode the behavior Max accepted as Shipped.
  If an audit fails on the baseline, the temptation is to
  investigate the behavior (is this a bug in `CameraChoreographer.js`?
  should the Shipped recording have been rejected?) — but the
  baseline is frozen by the Shipped flip. Any audit failure on
  the baseline means the audit is wrong.
  **Why it happens:** the telemetry-vs-eyeball reconciliation
  is ambiguous without a forcing rule. A flaky audit looks
  indistinguishable from a subtle behavior bug.
  **Guard:** AC #1 / #2 / #3 each include a **retroactive check**
  clause that explicitly states *"iterate the audit thresholds
  / logic, do NOT modify `CameraChoreographer.js`."* If
  working-Claude identifies what appears to be a genuine WS 3
  behavior bug during backfill, it is a **followup** (new
  workstream brief), not this workstream's scope.

- **Risk: Pixel-check harness ships a flaky/platform-dependent
  test.** Canvas-pixel reads are GPU-dependent; anti-aliasing,
  subpixel rasterization, and even Chrome version can shift
  a bright-star centroid by fractions of a pixel. A harness
  that fails intermittently on a baseline that the shake
  mechanism is verifiably not regressing is worse than no
  harness — it trains future working-Claude sessions to
  ignore audit failures.
  **Why it happens:** the naive pixel-equality check (`frameA[x][y] === frameB[x][y]`) is flaky by default. Centroid-based
  displacement with a tolerance band is robust but requires
  choosing the band carefully.
  **Guard:** AC #4 specifies **sub-pixel displacement** with
  `PIXEL_EPS = 1.0 px` as a tunable floor, and **centroid-
  based** measurement (not pixel-equality). If the retroactive
  check against `1bb5eb2` + `3b926aa` returns displacements
  that vary by >0.5 px across repeated runs, the harness is
  flaky — widen the tolerance band OR pin the canvas size /
  device-pixel-ratio before capture. Flakiness at the
  baseline is a harness-design bug, not a shake-regression.

- **Risk: The new sample-shape fields balloon sample size
  past a practical buffer limit.** The current sample shape
  (shake-redesign) is ~15 fields, all scalars or small arrays.
  Adding `lookAtTarget`, `navBodyPos`, `navNextBodyPos`,
  `subsystemDefaultTarget` = four 3-vectors = ~12 new float
  fields per sample. At ~60 fps over a 60s tour that's 3600
  samples × ~27 fields × ~8 bytes = ~800 KB. Tolerable for a
  single in-memory buffer, but if the buffer leaks across
  captures or gets stored in a long-running diagnostic it
  becomes a problem.
  **Why it happens:** no one audits sample-size growth unless
  it's measured.
  **Guard:** `_captureTelemetrySample` already uses `.toFixed(4)`
  on vec3 components, so precision is bounded. Confirm the
  new snapshot fields use the same rounding. Confirm the
  existing `_telemetryState` buffer is cleared on `.stop()` —
  spot-check by reading `_telemetryState.samples === null`
  post-stop. The shake redesign's buffer lifecycle is already
  correct; this workstream inherits that correctness.

- **Risk: `subsystemDefaultTarget` extraction leaks through the
  choreographer's output.** AC #3 requires capturing the
  motion-frame's `lookAtTarget` **before** pan-ahead bias is
  applied, so the audit can compute the bias direction. The
  current pipeline is:
  `motionFrame.lookAtTarget` → `EstablishingMode.update()` →
  `cameraChoreographer.currentLookAtTarget` (post-bias).
  The pre-bias value is available as `motionFrame.lookAtTarget`
  directly from `navSubsystem.getCurrentPlan()` /
  `navSubsystem._lookAtTarget`. The audit needs the snapshot
  at sample-time, which is AFTER both the subsystem update
  and the choreographer update (they run in that order). This
  is fine because `motionFrame.lookAtTarget` is not mutated
  by the choreographer — the choreographer writes into
  `_currentLookAtTarget`, not back into the motion frame.
  **Why it might drift:** a refactor that has the choreographer
  mutate the motion frame in-place would retroactively break
  this audit, without the audit's failure mode being obvious.
  **Guard:** AC #3 specifies extracting `subsystemDefaultTarget`
  from the motion frame explicitly. Diff review: if the sample
  captures `subsystemDefaultTarget` by reading from
  `cameraChoreographer` or `flythrough` (not from `navSubsystem`
  / the motion frame), escalate to Director — it suggests the
  motion frame is being mutated.

- **Risk: `previousStationBodyPos` derivation from samples is
  ambiguous at tour start.** AC #1's linger-target check
  requires walking backward from a LINGERING sample to find
  the last STATION `shipPhase` sample and reading its
  `navBodyPos`. On the first STATION→CRUISE transition of a
  tour this is well-defined. But a capture that starts
  mid-linger (buffer cleared, `telemetry.start()` called
  after STATION was already entered) will have no backward-
  reachable STATION sample and the audit must handle the
  partial-capture case gracefully.
  **Why it happens:** canvas-recorder captures can start at
  arbitrary times; telemetry captures don't necessarily align
  with tour boundaries.
  **Guard:** AC #1's violation-reporting should include a
  `missingPreviousStation: true` flag for LINGERING samples
  where backward-walking fails, classified as "unverifiable"
  not "failed." The `passed` result excludes unverifiable
  samples. A capture with >20% unverifiable samples is a
  harness-usability issue (capture later or reset the scene
  before `telemetry.start()`), not an audit failure.

## In scope

- **Telemetry sample-shape extensions** in
  `src/main.js` `_captureTelemetrySample()` — add the six new
  fields (`cameraMode`, `framingState`, `lookAtTarget`,
  `navBodyPos`, `navNextBodyPos`, `subsystemDefaultTarget`)
  with appropriate `.toFixed(4)` precision and null-safety on
  body refs.
- **Four audit helpers** under
  `window._autopilot.telemetry.audit.*`: `lingerTargetCorrect`,
  `independentPacing`, `panAheadBias`, plus the combined
  `runAllCameraAxis`.
- **One pixel-check harness** — location TBD by working-Claude
  (inline under `window._autopilot.telemetry.pixelCheck.*` OR
  as a separate helper at `~/.claude/helpers/pinned-star-pixel-check.js`
  if the canvas-capture flow benefits from living alongside
  `filmstrip.js` and `canvas-recorder.js`). Signature per AC #4.
- **Retroactive verification run** against the WS 3 Shipped
  baseline. Telemetry capture during a fresh Sol D-shortcut tour;
  `runAllCameraAxis()` returns `passed: true`. Pixel-check runs
  against a paused-scene harness; `displacement < 1.0 px`.
- **`## Status` appendix in this brief** with the retroactive
  verification report per AC #7.
- **Commits per AC #8** — sample-shape + camera-axis audits
  (one); pixel-check harness (two); Status update (three or
  folded into two).

## Out of scope

- **Any changes to WS 3 behavior** — `CameraChoreographer.js`,
  `EstablishingMode`, `FlythroughCamera.js` wiring. If the
  retroactive check surfaces what looks like a WS 3 bug, record
  it as a followup and do not fix it in this workstream's commits.
- **Any changes to shake-redesign behavior** — `ShipChoreographer.js`
  rotation-only shake, `_firedThisLeg` per-leg budget, signal
  gating. The pinned-star pixel check is a **runtime observer**
  on the existing shake mechanism, not a modification.
- **New ACs beyond the retroactive coverage of WS 3 + shake
  AC #19.** Per-body ESTABLISHING tuning, per-spectral-class
  framing, SHOWCASE / ROVING authored behavior — all are future
  workstreams. This brief's audits provide the substrate those
  workstreams will extend; the audits themselves do NOT try to
  predict their shape.
- **UI / HUD / audio.** No telemetry display surface; the audit
  results go to console / test runners only.
- **Non-camera-axis telemetry.** Ship-motion smoothness audits,
  warp-phase telemetry, hashgrid telemetry — all out. The
  `runAllCameraAxis()` name is deliberate: this is a *camera-axis*
  coverage package, not a general-purpose autopilot telemetry
  overhaul.
- **Headless / CI integration.** The audits run against live
  canvas capture via `mcp__chrome-devtools__*` during agent
  sessions. Wiring them into a headless test suite (Vitest,
  Playwright without a real GPU, etc.) is a separate
  infrastructure concern.
- **Test harness for the approach-orbit continuity workstream.**
  That workstream (`autopilot-approach-orbit-continuity-2026-04-22.md`)
  has its own scoping for velocity continuity — its regression
  gate may also want telemetry support, but its ACs are different
  (velocity-magnitude continuity at phase boundaries, not framing
  invariants). Out of scope here; that workstream picks up its
  own audit-helper scope when activated.
- **The travel-feel speed-field parking-lot issue.** Feature-
  level articulation is parked at
  `docs/FEATURES/autopilot.md` §"Parking lot"; no telemetry
  coverage until the feature lands.

## Handoff to working-Claude

**Precondition: WS 3 must be Shipped before execution begins.**
Retroactive verification against a baseline requires the baseline
to be accepted. This brief is `Drafted — pending WS 3 Shipped +
Director audit` until Max flips
`autopilot-camera-axis-retirement-2026-04-23.md` `## Status` to
`Shipped <sha>`. Once that happens, Director re-audits this brief,
and the `~/.claude/state/dev-collab/active-workstream` pointer
flips from `autopilot-camera-axis-retirement-2026-04-23` to
`autopilot-telemetry-coverage-2026-04-23`.

Read this brief first. Then, in order:

1. **`docs/WORKSTREAMS/autopilot-camera-axis-retirement-2026-04-23.md`**
   — the Shipped baseline. Especially `## Status` (WS 3 ACs' specific
   Shipped observations: linger 1.749s, pan-ahead bias peak 0.35,
   framing transitions decoupled), and ACs #4 / #5 / #6 (the
   felt-experience criteria this workstream backfills).
2. **`docs/WORKSTREAMS/autopilot-shake-redesign-2026-04-21.md`**
   — `## Status` (Shipped at `1bb5eb2`), ACs #16 / #17 / #18 / #20
   (the telemetry pattern shape this workstream replicates), AC #19
   (the code-grep surface-invariant this workstream upgrades to
   runtime observability).
3. **`src/main.js` L441–623** — the existing
   `window._autopilot.telemetry.*` API: start/stop/count lifecycle,
   the four shake audits (`orbitCrossProduct`, `signalCoincidence`,
   `envelopeFitsPhase`, `perLegFireBudget`), and `runAll`.
   **This is the pattern to model after, line-for-line in shape.**
4. **`src/main.js` L625–683** — `_captureTelemetrySample()`. The
   function this workstream extends with six new fields. Preserve
   `.toFixed(4)` precision, preserve null-safety on `bodyRef` /
   `nextBodyRef`, preserve the existing field set.
5. **`src/auto/CameraChoreographer.js`** — note the public
   getter surface (`currentMode`, `currentLookAtTarget`,
   `framingState`, `lingerElapsed`, `panAheadBias`) and the
   `FramingState` enum. Samples read through those getters; no
   private-state access needed.
6. **`src/auto/NavigationSubsystem.js`** — `bodyRef`,
   `nextBodyRef`, `_lookAtTarget`, `getCurrentPlan()`. The
   `motionFrame.lookAtTarget` is the pre-bias target for AC #3's
   `subsystemDefaultTarget`.
7. **`~/.claude/helpers/filmstrip.js`** and
   **`~/.claude/helpers/canvas-recorder.js`** — existing canvas-
   capture helpers. Pattern-match for the pixel-check harness'
   capture flow.
8. **`docs/PERSONAS/pm.md` §"Per-phase AC rule carve-out: process
   / tooling workstreams"** — the ACs here are contract-shaped by
   carve-out (no authored game-feature phases); that carve-out
   is what permits the "deliverable's interface + verifiable
   observation" shape above.
9. **`docs/REFACTOR_VERIFICATION_PROTOCOL.md`** — Well Dipper's
   refactor-verification protocol, authored during WS 1. Same
   pattern: telemetry-equivalence, not canvas recording, for
   changes whose contract is "zero behavioral change." This
   workstream's retroactive verification inherits that shape —
   the Shipped baseline is the contract, the audits are the
   equivalence check.

Then, in order of execution:

1. **Extend `_captureTelemetrySample()`** with the six new fields
   (AC #6). Verify the shake audits (AC #16 / #17 / #18 / #20)
   still pass on a fresh Sol tour capture — back-compat check,
   not feature work.
2. **Implement `lingerTargetCorrect`** (AC #1). Run against Sol
   tour capture; iterate thresholds until `passed === true` on
   the WS 3 Shipped baseline. **If the audit fails on the
   baseline, the audit is wrong — do NOT modify
   `CameraChoreographer.js`.**
3. **Implement `independentPacing`** (AC #2). Same pattern —
   retroactive-first, baseline is frozen.
4. **Implement `panAheadBias`** (AC #3). Same pattern.
5. **Implement `runAllCameraAxis`** (AC #5). Mirror shape of
   `runAll` at L606–620.
6. **Design the pixel-check harness** (AC #4). Before coding:
   name the scene-freeze strategy (pause what, on which keybinding),
   the bright-star identification strategy (known sky direction?
   brightest pixel in a patch?), the centroid computation, the
   tolerance band derivation. Surface the design in chat; sanity-
   check against drift-risk #3 (flakiness) before implementing.
7. **Implement the pixel-check harness** against the Shipped
   shake baseline (`1bb5eb2`). Assert `displacement < 1.0 px`
   over repeated runs (at least 3× to gauge flakiness).
8. **Run the retroactive verification** — fresh Sol D-shortcut
   tour, telemetry captured, `runAllCameraAxis` all-pass, pixel-
   check all-pass. Capture the results for AC #7.
9. **Update this brief's `## Status`** with the retroactive
   verification report (AC #7).
10. **Commit per AC #8** — two or three commits. Stage only
    `src/main.js` changes + (optionally) the pixel-check helper
    file + this brief's Status update. Never `git add -A`.
11. **Close at `VERIFIED_PENDING_MAX <sha>`** — per standard
    Shipped-gate protocol. Telemetry workstreams do NOT require
    a canvas recording (the ACs are contract-shaped per
    §"carve-out"), but they DO require Max's greenlight on the
    audit thresholds + the retroactive report before Shipped.

**If any audit fails on the WS 3 Shipped baseline, stop and
escalate to Director.** This is not a signal to modify WS 3
code. Per drift-risk #2, it's a signal that the audit is wrong.

**If the pixel-check harness is flaky (>0.5 px variance across
repeated baseline runs), stop.** Per drift-risk #3, widen the
tolerance band deliberately OR pin canvas size / DPR; do not
ship a flaky harness.

**If you find yourself wanting to add a fifth audit ("also cover
the warp-exit → ENTRY pacing"), stop.** That's scope creep into
WS 2 / WS 4 territory. This workstream's coverage package is four
helpers, bundled as specified.

Artifacts expected at close: 2–3 commits (sample-shape + camera
audits; pixel-check harness; optional Status commit); this brief
at `VERIFIED_PENDING_MAX` with the retroactive report appendix;
feature doc's `## Workstreams` section unchanged (this workstream
is a coverage backfill, not a feature advance, and does not
warrant a feature-doc entry — confirm at execution time with
Director; if Director calls for a feature-doc mention, PM adds
it as a tooling-workstream callout under a new
`### Tooling / verification workstreams` subsection).

Drafted by PM 2026-04-23 following Max's question in WS 3
review + Director's recommendation of the hybrid (ship WS 3 on
eyeball, scope telemetry backfill now).
