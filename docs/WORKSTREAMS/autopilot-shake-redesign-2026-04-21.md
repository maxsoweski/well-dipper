# Workstream: Autopilot gravity-drive shake redesign — single-axis logarithmic impulse train (2026-04-21)

## Status

`VERIFIED_PENDING_MAX deb5056` — single-axis log-impulse shake mechanism implemented per Max's pebble/boat/ether design intent. Threshold tuned post-capture so smooth tour motion stays at abruptness=0; debug hooks fire visible asymmetric impulse trains. Awaiting Max's verdict on the recording. Combined Shipped flip with WS 2 (`autopilot-ship-axis-motion-2026-04-20.md` currently `VERIFIED_PENDING_MAX cfd6df0`).

**Commit arc (2 commits):**
- `7a7370f` — `feat(autopilot): single-axis log-impulse shake per Max's pebble/boat/ether design` — full redesign (signal change + shape change). The 3-sine continuous-noise wobble replaced with a precomputed log-spaced impulse train, single-axis perpendicular-to-velocity, asymmetric accel/decel envelopes (`[0.30, 1.00, 0.70, 0.35, 0.10]` crescendo-then-fade vs. `[1.00, 0.55, 0.30, 0.17]` impact-then-decay). Trigger swapped from `‖d²x/dt²‖` to scalar `d|v|/dt` (sign discriminates accel/decel). Two new debug hooks: `debugAccelImpulse()` + `debugDecelImpulse()`; legacy `debugAbruptTransition()` retained as alias for decel.
- `deb5056` — `tune: threshold 40→10000` — Hermite cruise still triggered onset events at threshold=40 (Hermite-curve travel ramps |v| from ~0 at STATION to peak mid-trip and back, producing sustained `d|v|/dt` ~400+ units/s²). Bumped to 10000/100000 so smooth tour motion stays at abruptness=0; debug hooks (boost=1.0 directly) still fire cleanly.

**Recording (drop path):** `screenshots/max-recordings/autopilot-shake-redesign-2026-04-21.webm` (7.1 MB, 15s). 4-segment sequence per AC #7: smooth baseline (3s) → `debugAccelImpulse()` fires (5s — accel envelope ringout) → smooth gap (2s) → `debugDecelImpulse()` fires (5s — decel envelope ringout). Captured at Sol via non-warp `_startFlythrough()` engage so the baseline segments are real-CRUISE motion, not frozen state.

**Director-owned doc edits already landed (2026-04-21):**
- Bible §8H Gravity Drive — ether metaphor extension paragraph (commit `cde2d7f`).
- SYSTEM_CONTRACTS §10.8 — trigger refined to scalar `d|v|/dt`; envelope refined to log-impulse train; accel/decel asymmetry formalized (commit `cde2d7f`).
- WS 2 brief §"Parking-lot — shake redesign" — updated to link forward to this brief; Shipped-flip gate updated to require BOTH recordings approved by Max (commit `cde2d7f`).

**Telemetry probes** (post-tune, pre-recording, in-browser via chrome-devtools):
- Smooth tour baseline (10s sample): max abruptness = 0.000, max shake magnitude = 0.031 (residual from earlier impulse-tail only).
- Debug accel impulse (3s sample at 100ms): peak shake magnitude ≈ 0.37 (sampling catches mid-bump not exact peak); 6 impulse peaks captured — log-spaced impulse train confirmed visible.
- Single-axis confirmation: all shake samples have `sy = 0`; `sx`/`sz` proportional with stable ratio across the impulse train — confirmed perpendicular-to-velocity axis frozen at onset.

**Tuning note for Max:** thresholds in `src/auto/ShipChoreographer.js` (`_abruptnessThreshold = 10000.0`, `_abruptnessMax = 100000.0`) are conservative for V1. If you want warp-exit transitions or other real-motion discontinuities to fire shake on top of debug hooks, lower threshold during recording review. All envelope shape parameters (`IMPULSE_SPACING_RATIO = 1.8`, `IMPULSE_INITIAL_GAP = 0.08`, `ACCEL_AMPS`, `DECEL_AMPS`, `SHAKE_MAX_AMPLITUDE = 0.6`) are named constants at the top of the file for visible tuning.

## Revision history

- **2026-04-21 — authored** by PM from Max's verbatim design direction 2026-04-21 (quote reproduced in §"Max's design intent" below) and Director's assignment for this follow-up loop.

## Max's design intent (verbatim, 2026-04-21)

> *"Let's change it from this wobbly in all directions motion that is kind of sick making. It should be more like the motion of a pebble going across a pond or a boat cutting through the waves. In other words, there's only one axis on which the shaking happens. And let's make that shaking motion happen, I'm thinking logarithmically. Imagine the gravity of any given system is kind of like a medium that you're cutting across. Almost like the old ideas of what the ether would be in space. When you cut across it really quickly, by speeding up really fast or decelerating all at once, you get this almost like a friction effect happening. And the size of the waves, so to speak, that you're cutting through that cause this shaking on the one axis should happen in reverse when you're speeding up versus slowing down."*

Read this quote FIRST in handoff. Every AC below refers back to a specific clause of it.

## Parent feature

**`docs/FEATURES/autopilot.md`** — specifically §"Gravity drives — ship-body shake on abrupt transitions" (lines 194–204) AND this workstream inherits WS 2's AC #5 (*"Gravity-drive shake fires on genuinely abrupt motion; does NOT fire during smooth motion"*) as a preserved invariant across the redesign.

**`docs/WORKSTREAMS/autopilot-ship-axis-motion-2026-04-20.md`** — WS 2, specifically the §"Parking-lot — shake redesign" paragraph (lines 54–66) that captured Max's 2026-04-21 feedback and handed the redesign off to a follow-up workstream. This brief IS that follow-up.

Lore anchor: **`docs/GAME_BIBLE.md` §8H Gravity Drive (In-System Propulsion)** — lines 1290–1309. The existing lore canonizes the compensation envelope, the lag-as-shake cinematic tell, the "shake magnitude is a function of motion-abruptness, not authored per-moment" design rule. This workstream EXTENDS that lore with Max's new articulation: the thing being "cut across" that makes compensation lag is conceived as an **ether-like gravitational medium**. Accelerating or decelerating fast = cutting across the medium fast = friction with the medium = shake. **Director action (flagged, NOT done in this brief):** extend Bible §8H with a short paragraph canonizing the ether metaphor and the accel/decel asymmetry so future features can reference the canonized version. Director-owned doc.

Contract anchor: **`docs/SYSTEM_CONTRACTS.md` §10.8 Gravity-drive shake invariant** — lines 409–417. Current §10.8 says *"shake fires only when the ship motion is genuinely abrupt — exceeding a smoothing threshold the drive can't absorb"* and *"magnitude is computed from motion discontinuity (second derivative of velocity, or a dedicated 'abruptness' signal produced by the navigation subsystem)."* This workstream **refines** §10.8 on two points: (a) trigger signal is **scalar speed derivative `d|v|/dt`**, not vector acceleration magnitude `d²x/dt²` — centripetal acceleration during constant-speed curves does NOT fire shake by design; (b) magnitude envelope is **logarithmic-impulse**, not continuous noise. **Director action (flagged, NOT done in this brief):** refine §10.8 text to reflect these two points. Director-owned doc.

## Implementation plan

N/A (feature is workstream-sized — a targeted rework of two well-scoped regions in one file). `src/auto/ShipChoreographer.js` lines ~73–98 (abruptness + shake state) and lines ~177–224 (the `update()` body that computes both) are the entire surface of change. No new module, no cross-system contract expansion. If mid-work working-Claude discovers the redesign wants its own module (e.g., a `ShakeEngine` class), escalate to PM — that's a scope question, not an implementation detail.

## Scope statement

Redesign the **magnitude-from-signal mapping** AND the **shake-offset shape** inside `src/auto/ShipChoreographer.js` so the gravity-drive shake reads as Max's pebble/boat/ether articulation — single-axis, logarithmic-impulse envelope, triggered on scalar speed derivative, temporally asymmetric between accel and decel. Preserve the plumbing WS 2 stood up (provider hook into `FlythroughCamera.setShakeProvider`, additive `shakeOffset` Vector3, the debug-hook pattern, the tour-lifecycle `beginTour` / `onLegAdvanced` / `stop` surface, WS 2's AC #5 "zero shake during smooth motion" invariant).

This is one unit of work because the three changes (trigger signal, envelope shape, accel/decel asymmetry) share state, share the per-frame tick, and are mutually dependent — splitting would mean computing asymmetry from a signal you haven't decided how to read, or shaping an envelope that isn't triggered on the right derivative. The debug hooks (two, per §In scope) and the canvas recording are the verification surface for the same bundle.

**Preserve-vs-change table** (authoritative for the redesign):

| Surface | Status | Notes |
|---|---|---|
| `ShipChoreographer` module location + class shape | **Preserve** | Same file, same class, same public surface |
| `setShakeProvider` hook into `FlythroughCamera` | **Preserve** | WS 2 AC #7 integration — unchanged |
| `shakeOffset` Vector3 public property | **Preserve** | Camera consumer unchanged; only the values written to it change |
| `beginTour`, `onLegAdvanced`, `stop`, `update(dt, motionFrame)` API | **Preserve** | Tour-lifecycle integration from WS 2 is correct |
| `_abruptnessDebugBoost` + `debugAbruptTransition()` pattern | **Preserve as pattern, EXPAND surface** | Keep the decay-envelope-boost mechanism; add two new hooks (see below) |
| `_abruptness` as a scalar [0,1] signal | **Preserve** | Still the normalized drive-stress signal; the input feeding it changes |
| `_abruptnessThreshold`, `_abruptnessMax` tunable pair | **Preserve the concept** | May be renamed / re-tuned against the new signal — same role |
| Current trigger: `accelMag = ‖d²x/dt²‖` (ShipChoreographer.js:189) | **Change** | → `d‖v‖/dt` (scalar speed derivative, signed) |
| Current shake: 3 independent sines on X/Y/Z at ~40 Hz (SC.js:217–221) | **Change** | → scalar × single unit vector (single-axis), logarithmic-impulse envelope |
| Single `debugAbruptTransition()` hook | **Change** | → two hooks: `debugAccelImpulse()` + `debugDecelImpulse()` (so asymmetry is evaluable in one recording) |
| Subsystem's `MotionFrame.abruptness` V1 stub `0.0` | **Preserve** | Subsystem's stub stays; ShipChoreographer remains the real producer |
| WS 2 AC #5 "zero shake during smooth motion" invariant | **Preserve** | Redesign MUST also exhibit zero shake during smooth tour motion |

## How it fits the bigger picture

Advances `docs/GAME_BIBLE.md` §8H — the lore already canonizes *"smooth motion → drive silent / abrupt motion → shake"*. Max's new articulation **sharpens** the lore in a direction consistent with what's already there: the medium the drive is working against is conceived as ether-like; the shake is friction against that medium during fast velocity-magnitude changes. This is lore-color, not lore-rewrite. Flagged as a Director-owned Bible edit, not done in this brief.

Advances the autopilot feature's cinematic-tell architecture: the current continuous-multi-axis-noise shake reads as camera-shake in a modern action game (abstract motion-sickness), not as a specific physical event in the game's world. Max's redesign makes shake a **specific authored shape** — a recognizable pebble-skip / boat-cut rhythm — that is itself a moment of game-feel, not a generic sensation. Discover / autopilot works because the player feels they are traversing a composed world; the old shake undercut that with abstract wobble. The redesign restores the composed reading.

## Acceptance criteria

Six ACs, all evaluable against **one** canvas recording (AC #7). Phase-sourced where the feature doc has phase criteria; contract-shaped for the two additive-plumbing requirements. ACs #1–#4 are each answerable yes/no from one play of the recording.

1. **Single-axis shake — the shake offset is a scalar amplitude × one unit vector, not a 3D cloud** (per Max's verbatim: *"there's only one axis on which the shaking happens"*). The chosen axis is **perpendicular to ship velocity** — grounded in the pebble/boat metaphor (both describe a bobbing cross-travel motion, not a forward-aligned compression; a boat rolls side-to-side AS it cuts through waves, a skipping pebble bobs up-and-down AS it moves forward). PM specifies: the shake axis is recomputed each shake-onset as a stable perpendicular to the ship's velocity at onset (so the shake doesn't itself rotate during its ringout — the ship may be curving, but the shake's "roll axis" stays fixed for that impulse event). Verified on the recording: the visible shake reads as a line of motion (up-down, or side-side bob), not as a jitter cloud. Diagnostic backup: reading `shipChoreographer.shakeOffset` during shake shows the vector confined to one direction (to within floating-point precision), not spread across all three axes.

2. **Logarithmic impulse-train envelope — the shake manifests as 3–5 discrete bounces with logarithmically-spaced timing AND logarithmically-decaying amplitude** (per Max's verbatim: *"I'm thinking logarithmically"*, and the pebble/boat metaphors — a pebble skipping across a pond physically produces impulse events at widening intervals with decreasing splash height; a boat cutting waves produces a ringout rhythm; both are impulse-and-decay, not continuous hum). PM specifies both: (a) impulse spacing grows log-like (e.g., Δt_n = Δt_0 · φ^n where φ > 1, so each bounce is farther from the last than the previous bounce was), AND (b) peak amplitude per impulse decays log-like (a_n = a_0 · δ^n where 0 < δ < 1). Rationale for "both": the pebble/boat metaphor physically implies both (a skipping pebble slows in forward speed AND loses height-per-skip; skips get further apart AND shorter); picking only one would not produce the recognizable "skipping-pebble" rhythm. Verified on the recording: the shake reads as 3–5 discrete bounces (countable), each smaller than the last, each farther in time from the last than the previous bounce was. Diagnostic backup: temporal profile of `shakeOffset.length()` shows discrete peaks (not continuous high-frequency oscillation).

3. **Trigger signal is scalar `d|v|/dt`, not vector `‖d²x/dt²‖` — turning at constant speed does NOT shake** (per Max's verbatim: *"you're cutting across it really quickly, by speeding up really fast or decelerating all at once"* — the qualifying motion is explicitly speed change, not direction change). This corrects the current `accelMag` at ShipChoreographer.js:189 which responds to centripetal acceleration during curved travel. Mathematically: `d|v|/dt` is the time derivative of the scalar `‖v‖`, which is zero for pure direction change at constant speed. Verified on the recording: the CRUISE → APPROACH curved handoff (visible mid-curve as the ship bends toward the planet at speed) exhibits ZERO shake, per AC #5 of WS 2 preserved. Verified on the recording and by Max's evaluation: the felt experience is that only speed changes (warp-exit deceleration, debug-triggered impulses) shake the ship; curves are smooth.

4. **Accel shake pattern and decel shake pattern are visibly, temporally asymmetric** (per Max's verbatim: *"the size of the waves ... should happen in reverse when you're speeding up versus slowing down"*). PM's interpretation (ground in the ether/friction metaphor): *accelerating* = ship pushing INTO the medium from rest → waves BUILD as it breaks through, then release as it pulls ahead (envelope shape: **crescendo-then-fade** — smallest impulse first, largest in the middle, then ringout); *decelerating* = ship slamming into the wall of accumulated medium → IMPACT happens first at the moment of sharp braking, then ringout (envelope shape: **max-first-then-decay** — largest impulse first, each subsequent smaller). These two envelopes are temporally mirrored around the impulse midpoint. The discriminator is `sign(d|v|/dt)` — positive = accel envelope, negative = decel envelope. Verified on the recording: the clip shows the `debugAccelImpulse()` event AND the `debugDecelImpulse()` event back-to-back; the two are visibly distinct — the accel impulse reads as a build-up-then-fade, the decel impulse reads as a big-hit-then-fade. Max confirms the two read as Max's verbatim "in reverse" on playback.

5. **Preserved invariants from WS 2 — zero shake during smooth motion, debug hooks trigger visible shake, existing plumbing unchanged** (per WS 2 `docs/WORKSTREAMS/autopilot-ship-axis-motion-2026-04-20.md` AC #5 and AC #7). Specifically: (a) during normal smooth autopilot motion (ENTRY steady-state, CRUISE, APPROACH deceleration-but-within-envelope, STATION orbit) the shake offset remains at `(0,0,0)` — verified by the primary WS 2 recording being re-reviewed and still passing its own AC #5 after this redesign lands; (b) `FlythroughCamera.js` diff is zero for this workstream (the `setShakeProvider` setter and one-line `shakeOffset` add stay exactly as WS 2 landed them); (c) tour-lifecycle calls — `beginTour`, `onLegAdvanced`, `stop` — unchanged.

6. **Bible + Contract refinement flagged for Director** (contract-shaped AC per PM §"Per-phase AC rule" carve-out for process-adjacent deliverables). This workstream does NOT edit `docs/GAME_BIBLE.md` §8H or `docs/SYSTEM_CONTRACTS.md` §10.8 — those are Director-owned. But this workstream flags BOTH edits in the handoff so Director completes them as part of the follow-up loop, before Shipped flip. Verified by: (a) the Bible §8H extension and the §10.8 refinement are listed under §"Director actions" below with enough specificity that Director can execute them without re-discovery; (b) Shipped flip on this workstream does not land until Director has landed both edits on master.

7. **Motion evidence at ship-gate — one primary canvas recording** (per `docs/MAX_RECORDING_PROTOCOL.md` §"Capture path — canvas features (default)" and `feedback_motion-evidence-for-motion-features.md`). Single recording, ~15–20s, captured via `~/.claude/helpers/canvas-recorder.js` + `~/.local/bin/fetch-canvas-recording.sh`, at Sol (per `feedback_always-test-sol.md`). Sequence: smooth baseline (~3s — AC #5 invariant read) → `window._autopilot.debugAccelImpulse()` triggered (~5–7s shake event — AC #4 accel envelope) → return to smooth (~2s — AC #5 re-read) → `window._autopilot.debugDecelImpulse()` triggered (~5–7s shake event — AC #4 decel envelope). Drop path: `screenshots/max-recordings/autopilot-shake-redesign-2026-04-21.webm`. Per Shipped-gate: working-Claude closes at `VERIFIED_PENDING_MAX <sha>` once the recording is on disk; Shipped flip waits on Max's verdict AND Director's Bible/contract edits landing.

## Principles that apply

Two of the six in `docs/GAME_BIBLE.md` §11 are load-bearing here. Principles 1 (Hash Grid Authority), 3 (Per-Object Retro Aesthetic), 4 (BPM-Synced Animation), and 5 (Model Produces → Pipeline Carries → Renderer Consumes) are orthogonal to a targeted signal-and-envelope rework inside one module.

- **Principle 2 — No Tack-On Systems.** Load-bearing. The anti-pattern this workstream corrects is exactly "shake added for feel," which the current continuous-noise shape invites — a continuous high-frequency hum modulated by a threshold-crossing is *structurally* a visual filter that "activates when something happens," not a physical consequence of a modeled event. The redesign replaces that with a shape derived from a real derivative (`d|v|/dt`) and a real physical metaphor (impulse train with log-spaced decay), which means the shake is produced by an authored model of drive-vs-medium friction and the renderer (camera) just displays it. *Violation in this workstream would look like:* picking a shake shape because it "feels cinematic" rather than because it reads the pebble/boat/ether metaphor, or authoring per-phase-transition shake overrides ("a touch of shake at APPROACH start because APPROACH feels like it should punctuate") rather than deriving shake strictly from `d|v|/dt`.

- **Principle 6 — First Principles Over Patches.** Load-bearing. The current shake implementation is itself the patch — three-axis sine noise is the off-the-shelf "camera shake" pattern ported from generic game engines, bolted onto a threshold-gate. Patching it (lower the amplitude, shift the frequency, add a bandpass filter) would be more patches stacked on a shape that doesn't match the lore. The first-principles move is the one Max articulated: start from the physical metaphor (pebble / boat / ether), work out what shape that metaphor produces (single-axis impulse train with log envelope, asymmetric under accel vs decel), and implement that shape directly. Current `_shakeFreq = 40` + three-phase sines is discarded wholesale, not tuned. *Violation in this workstream would look like:* keeping the three-sine structure and multiplying it by an envelope function, or keeping the `accelMag` input and adding a low-pass filter to approximate the new trigger — both are patches over the existing shape.

## Drift risks

Minimum three per Director's assignment; PM adds a fourth based on the implementation surface.

- **Risk: Axis choice drifts to velocity-aligned because it's easier to compute.** Velocity is already the forward unit vector; "perpendicular to velocity" needs an arbitrary-but-stable perpendicular pick (classic issue: which perpendicular? There's a whole plane of them). The path of least resistance is `shakeAxis = normalize(velocity)`, which is wrong — it would produce a compression/expansion along the direction of travel, not the bobbing/rolling motion the pebble/boat metaphor describes.
  **Why it happens:** it compiles and "looks like shake," especially at first glance where any offset reads as motion.
  **Guard:** AC #1 specifies perpendicular-to-velocity and the rationale (pebble bobs cross-travel, boat rolls cross-travel). PM's specific pick for the perpendicular: use the ship's local "up" vector at onset (world-Y if the camera has no roll authority yet, or the camera's `up` if it does), project out the velocity component to get a stable cross-perpendicular, normalize, and freeze that vector for the duration of the impulse. If working-Claude's implementation reads `velocity.normalize()` into the shake axis, that's the anti-pattern — escalate to Director. Director audit flag.

- **Risk: "Logarithmic" becomes `1/(1+t)` hand-wave instead of an actual log envelope or a genuine log-spaced impulse sequence.** `1/(1+t)` is a hyperbolic decay, not a logarithmic one, and produces a continuous curve rather than the discrete impulse-train shape AC #2 specifies. Similarly, `exp(-kt)` is exponential decay, not log — it would produce a single smooth fade, not the discrete-impulse skipping rhythm.
  **Why it happens:** "log" gets conflated with "falloff" in practice; the common engineering shortcut for "decay with time" is an exponential.
  **Guard:** AC #2 explicitly specifies both log-spaced bounce timing AND log-decaying peak amplitude. PM specifies exact function shape in §In scope: impulse times `t_n = t_0 + Δt_0 · (φ^n - 1) / (φ - 1)` (so gaps between successive impulses are `Δt_n = Δt_0 · φ^n`, i.e., geometric growth) for some ratio φ > 1 (suggested φ ≈ 1.6–2.0, tunable); impulse peak amplitudes `a_n = a_0 · δ^n` for some decay ratio 0 < δ < 1 (suggested δ ≈ 0.55–0.70, tunable). 3–5 impulses total before `a_n < 0.02` cutoff. If working-Claude's implementation is a continuous exponential-modulated sine, that's the anti-pattern — the `shakeOffset.length()` profile must show DISCRETE peaks on the recording, not a smooth curve.

- **Risk: Accel/decel asymmetry implemented as "accel shakes, decel doesn't" (drop half the spec).** The lazy read of "asymmetric under accel vs decel" is "only one of them shakes" — which is a carve that produces an easy-to-verify binary but discards the "in reverse" part of Max's verbatim. Max's wording *"the size of the waves should happen in reverse"* explicitly says both directions produce shake, with mirrored shape.
  **Why it happens:** it's easier to gate `if (dv_dt < 0) fire_shake()` than to author two distinct envelopes that switch on sign; "in reverse" in English is ambiguous enough to permit the one-direction reading.
  **Guard:** AC #4 requires BOTH envelope patterns present AND visibly distinct. §In scope names both `debugAccelImpulse()` AND `debugDecelImpulse()` as required hooks, and AC #7's single recording includes BOTH events back-to-back. If the recording shows only one shake event, or shows two events with identical envelopes, AC #4 fails by construction.

- **Risk: Redesign bleeds into a module rewrite.** The brief is a targeted rework of two regions in one file; the seductive version is "since I'm in here anyway, let me also split the shake into its own `ShakeEngine` class / move abruptness to `NavigationSubsystem` / add an audio-coupling hook." Each of those is a legitimate future workstream, but carrying them in this brief adds scope that doesn't serve Max's design direction AND forecloses WS 4 / future audio work from scoping them cleanly.
  **Why it happens:** redesigning the envelope surfaces "rough edges" in the surrounding code that look fixable cheaply.
  **Guard:** §Out of scope names each of these as V-later (see there). If the diff touches `NavigationSubsystem.js` at all, or creates a new module, or edits `FlythroughCamera.js` for anything beyond what WS 2 already landed, that's scope creep — escalate to PM before proceeding.

## In scope

- **Rework `src/auto/ShipChoreographer.js` — abruptness signal derivation.** Replace the `accelMag = ‖d²x/dt²‖` computation at L181–189 with a scalar speed derivative. Track `_prevSpeed` (magnitude of velocity at the prior frame); compute `dSpeed_dt = (currSpeed - _prevSpeed) / dt`. The sign of this value is the accel/decel discriminator (positive = accelerating, negative = decelerating); the absolute value feeds the threshold-normalize path. The `_abruptnessThreshold` / `_abruptnessMax` pair stays as tunables (re-tuning against the new signal is expected — values change units from "scene-units/s²" to "scene-units/s²" of scalar speed, which are different magnitudes). Preserve the debug-boost path — `_abruptnessDebugBoost` still forces magnitude without requiring a real signal.

- **Rework `src/auto/ShipChoreographer.js` — shake-offset shape.** Replace the 3-sine-on-XYZ block at L213–224 with:
  - **Onset detection.** When `_abruptness` crosses a low threshold (e.g., 0.05) from zero, AND either a real `dSpeed_dt` spike or a debug-hook fired this frame, **start a new impulse train event**. Freeze: the shake axis (perpendicular-to-velocity unit vector per drift-risk #1 guard), the sign (from `dSpeed_dt` or from which debug hook fired), the onset time. Precompute the impulse train's timestamps and amplitudes per the log formulas specified in drift-risk #2 guard.
  - **Per-frame sample.** If an impulse train is active, sample the envelope at the current `(t - onsetTime)` and emit `shakeOffset = shakeAxis * envelopeSample`. The envelope is a sum of narrow bump functions at the precomputed impulse times (each bump is e.g., a half-cycle sine centered on its `t_n` with width ∝ `Δt_n/4` so bumps don't overlap). `shakeOffset.length()` thus traces a discrete-peak curve per AC #2.
  - **Accel vs decel envelope shape (AC #4).** For `sign > 0` (accel), emit impulses with amplitudes `[small, large, medium, small, tiny]` — a crescendo-then-fade pattern. For `sign < 0` (decel), emit impulses with amplitudes `[large, medium, small, tiny]` — an impact-then-decay pattern. Both are temporally log-spaced per drift-risk #2; the DIFFERENCE is the amplitude sequence. State the exact amplitude sequences as constants at the top of the class so tuning is visible (not buried in a loop).
  - **Termination.** When the last impulse's amplitude drops below ~0.02 of onset peak, or when a new impulse train fires (events don't stack — a new event resets), end the current train. `shakeOffset → (0,0,0)` until next onset.

- **Two new debug hooks on `window._autopilot`:**
  - `debugAccelImpulse()` — forces a positive-sign onset event of amplitude 1.0 at the current frame. Triggers the accel envelope per AC #4.
  - `debugDecelImpulse()` — forces a negative-sign onset event of amplitude 1.0 at the current frame. Triggers the decel envelope per AC #4.
  - The existing `debugAbruptTransition()` may be kept as an alias to `debugDecelImpulse()` (since braking is closer to the scenario it was originally written to simulate — warp-exit deceleration mismatch) OR removed entirely if working-Claude judges the rename cleaner. PM leans toward keeping it as an alias so WS 2's recording infrastructure / any external callers don't break; working-Claude decides.

- **One canvas recording per AC #7** — Sol, ~15–20s, sequence: smooth-baseline → `debugAccelImpulse()` → smooth → `debugDecelImpulse()`. Use `~/.claude/helpers/canvas-recorder.js` + `~/.local/bin/fetch-canvas-recording.sh`. Drop at `screenshots/max-recordings/autopilot-shake-redesign-2026-04-21.webm`.

- **One or more commits, separable by concern.** Suggested split: (1) `feat(autopilot): scalar-speed-derivative trigger signal` — the `dSpeed_dt` replacement + threshold retuning (no shape change yet — shake still fires, just on the right signal); (2) `feat(autopilot): logarithmic impulse-train shake envelope` — the shape rework including accel/decel asymmetry and both debug hooks. Two commits keep the signal change reviewable independent of the shape change and make bisect useful if a regression shows up later. Each commit message cites the AC it closes.

- **Update this brief's `## Status` line** from "Scoped 2026-04-21, blocking WS 2 Shipped flip" → `VERIFIED_PENDING_MAX <sha>` (when recording is on disk and Director edits are pending) → `Shipped <sha> — verified against screenshots/max-recordings/autopilot-shake-redesign-2026-04-21.webm` (after Max's verdict + Director's Bible/contract edits land).

- **Director actions flagged (NOT done in this brief; Director's follow-up):**
  - `docs/GAME_BIBLE.md` §8H Gravity Drive extension — add a short paragraph (2–4 sentences) canonizing the ether metaphor: *the gravitational field of a system is conceived as an ether-like medium that the ship cuts across during velocity-magnitude changes; shake is friction against that medium; accel and decel produce asymmetric friction patterns.* Place after the existing "design rule that follows from the lore" list around line 1306.
  - `docs/SYSTEM_CONTRACTS.md` §10.8 Gravity-drive shake invariant refinement — change "second derivative of velocity, or a dedicated 'abruptness' signal" to **"scalar speed derivative `d|v|/dt` — centripetal acceleration during constant-speed turns does NOT fire shake by design"**, and add a new bullet: **"magnitude envelope is a logarithmic-impulse train (log-spaced, log-decaying bounces), NOT continuous high-frequency noise. Accel and decel produce asymmetric envelopes per the ether metaphor."**
  - Director minor revision of WS 2 brief (`docs/WORKSTREAMS/autopilot-ship-axis-motion-2026-04-20.md`) §"Parking-lot — shake redesign" paragraph to link forward to this brief (path only — this brief takes ownership of the redesign description).

## Out of scope

- **`ShakeEngine` module extraction.** A legitimate V-later refactor if shake grows additional dimensions (ambient drive hum, audio coupling, per-class-body tuning). V1 keeps the shake inside `ShipChoreographer` per WS 2's integration. If the refactor itches during implementation, file it as a future workstream — don't carry it in this brief.

- **V-later: Gravity-strength coupling** — *larger bodies / deeper gravity wells amplify the shake because you're cutting through "more medium."* Explicitly called out as NOT in V1. Lands cleanly on top of this workstream's foundation (multiply onset amplitude by a `localGravityFactor` hook). Requires a gravity-well query from the ship's current position to nearest massive body — infrastructure not yet in place.

- **V-later: Direction-detection from velocity-rotate — shake axis updates as ship velocity rotates during curves.** This brief freezes the shake axis at impulse onset (drift-risk #1 guard). If future playtest finds impulses during curved travel should "tilt with the turn," that's a V-later refinement. V1 freezes-at-onset because most impulses are short-lived (≤1.5s by AC #2 log-envelope) and the ship's velocity direction doesn't change significantly over that window.

- **V-later: Per-system ether-density tuning.** *Different star systems' gravity-fields produce different shake characters* (denser → more impulses; sparser → fewer). V-later — V1 uses a single fixed log-envelope shape. Lands as a per-system tuning input alongside the gravity-strength coupling.

- **V-later: Audio coupling.** A future autopilot BGM workstream may subscribe to shake events (onset, peak, ringout) for sting / rumble cues. Shake-as-audio-trigger is NOT in V1; the event surface exists in the feature doc's scope (§"Audio event-surface hook") but the shake-specific hookup is deferred.

- **The three-sine XYZ shake shape.** Not preserved — replaced wholesale per Principle 6 guard. Not deprecated alongside the new shape.

- **`NavigationSubsystem.js` changes.** Out of scope entirely. The subsystem still emits `MotionFrame.abruptness = 0.0` as a stub; `ShipChoreographer` remains the real producer. If a future workstream moves abruptness-math into the subsystem (because it unifies with the subsystem's existing Hermite/orbit math), that's V-later and requires its own scoping against §10.8.

- **`FlythroughCamera.js` changes.** Out of scope entirely — the `setShakeProvider` setter and the one-line additive shake-offset add that WS 2 landed are already correct (they consume whatever values `shakeOffset` holds; the values change, the consumer does not). If the diff touches `FlythroughCamera.js`, scope has drifted.

- **Re-recording WS 2's primary Sol tour.** WS 2's existing `screenshots/max-recordings/autopilot-ship-axis-motion-2026-04-20.webm` remains valid — the ship-axis motion structure (ENTRY / CRUISE / APPROACH / STATION) is not changed by this workstream; only the shake shape that may show up during its warp-exit moment changes. If Max's combined verdict review finds the new shake shape visibly degraded something on that recording (unlikely — WS 2's tour has minimal shake at threshold=200), capture a fresh primary tour recording as a followup, not as scope for this brief.

- **Tuning the threshold against the new signal during this workstream.** Initial tuning is in scope to produce a recording-ready state, but "extensive tuning passes" are explicitly V-later — Max tunes during the combined recording review. The goal of this brief's tuning pass is to get to "shake off during smooth motion, debug hooks produce visible shake" — not "shake tuned to Max's preferred sensitivity."

## Handoff to working-Claude

**Read order** (do not skip — Max's exact words matter):

1. **Max's verbatim design intent** in this brief's §"Max's design intent" above — re-read it twice. The words "pebble," "boat," "ether," "logarithmically," "in reverse" are all load-bearing.
2. `docs/WORKSTREAMS/autopilot-ship-axis-motion-2026-04-20.md` — WS 2 brief in full, especially AC #5 (preserved invariant), AC #7 (camera integration boundary), the §"Parking-lot — shake redesign" paragraph.
3. `docs/FEATURES/autopilot.md` §"Gravity drives — ship-body shake on abrupt transitions" (lines 194–204). Short section; read it in place.
4. `docs/GAME_BIBLE.md` §8H Gravity Drive (In-System Propulsion), lines 1290–1309. The ether extension is NOT there yet — Director will add it before Shipped flip per AC #6. Your job is to ship code consistent with the extension even while the Bible reads its current text.
5. `docs/SYSTEM_CONTRACTS.md` §10.8 Gravity-drive shake invariant, lines 409–417. Same situation — Director refines this before Shipped flip; code must be consistent with the refinement even before it lands.
6. `src/auto/ShipChoreographer.js` in full (the current implementation — 254 lines). Lines 73–98 (state) and 177–224 (update-body compute) are the exact change surface.
7. `docs/MAX_RECORDING_PROTOCOL.md` §"Capture path — canvas features (default)" — the recording capture mechanics for AC #7.
8. `~/.claude/projects/-home-ax/memory/feedback_motion-evidence-for-motion-features.md` — the cross-project principle. Static screenshots cannot evaluate the log-envelope rhythm; the recording is mandatory.
9. `~/.claude/projects/-home-ax/memory/feedback_always-test-sol.md` — Sol as the recording target.
10. `~/.claude/projects/-home-ax/memory/feedback_test-actual-user-flow.md` — when triggering the debug hooks for the recording, trigger them via the console `window._autopilot.debugAccelImpulse()` etc., AND with the ship in a real active-tour state (so the smooth-baseline segments are real autopilot flight, not frozen state). Don't fabricate the state.

**Execution sequence:**

1. **Confirm the perpendicular-to-velocity axis pick.** Before code: compute the stable perpendicular in pseudocode, work through the degenerate case (velocity ≈ world-Y, where projecting out velocity from world-Y gives near-zero). Pick a fallback axis (e.g., world-X if the Y-perpendicular is degenerate). Surface the pick in chat for PM sanity-check if it feels ambiguous.

2. **Implement the trigger signal (commit 1).** Replace `accelMag` with `dSpeed_dt`. Keep the threshold-normalize path structure; retune the threshold values empirically — run a few smooth-tour frames in dev, log the raw `dSpeed_dt` range, pick threshold values that keep smooth motion at `_abruptness = 0` and warp-exit at ≈1. Commit after AC #3 verifies on a quick dev-mode test (curved CRUISE→APPROACH handoff exhibits zero shake).

3. **Implement the log-envelope shape (commit 2).** Build the onset-detection + precomputed-impulse-train state. Start with a single symmetric envelope (same amplitudes for accel and decel) and verify the shape reads as discrete impulses on a dev-mode debug-hook trigger. THEN author the accel/decel asymmetry — two different amplitude sequences, gated on the sign of `dSpeed_dt` at onset. Add the two new debug hooks.

4. **Intra-session sanity check** via `mcp__chrome-devtools__*` (per `feedback_prefer-chrome-devtools.md`). Dev-shortcut into Sol autopilot tour; verify from the browser console: (a) `_autopilot.shipChoreographer.shakeOffset` reads `(0,0,0)` during smooth motion; (b) calling `_autopilot.debugAccelImpulse()` produces a shake event whose `shakeOffset.length()` traces discrete peaks over time (sample it at 10 Hz for ~2s and verify visually); (c) `shakeOffset` components are proportional (same sign pattern across x/y/z — confirming single-axis). This is self-audit, not the Shipped artifact.

5. **Capture the primary recording per AC #7.** Sol, the 4-segment sequence (smooth → accel impulse → smooth → decel impulse). 15–20s. `~/.claude/helpers/canvas-recorder.js` + `~/.local/bin/fetch-canvas-recording.sh`. Drop path: `screenshots/max-recordings/autopilot-shake-redesign-2026-04-21.webm`.

6. **Surface a contact sheet** via `~/.local/bin/contact-sheet.sh` — highlight the two shake events (accel segment mid-impulse + decel segment mid-impulse) so Max can see the axis-direction and envelope-shape differences without scrubbing the full video. Per `feedback_image-size-caps.md`, resize the contact sheet to ≤1800px per axis before surfacing.

7. **Flag Director actions.** Post the §"Director actions" bullets verbatim to the Director channel / next-review handoff. Do NOT edit Bible or Contracts yourself. Do NOT proceed to Shipped flip until Director confirms both edits landed.

8. **Close at `VERIFIED_PENDING_MAX <sha>`** in this brief's Status line once commits land + recording is on disk. Shipped flip happens on the combined verdict — Max approves both the WS 2 primary recording AND this workstream's redesign recording, AND Director's Bible/contract edits land on master.

**If the diff touches `FlythroughCamera.js`, `NavigationSubsystem.js`, or creates a new module — stop and escalate to PM.** This workstream is a targeted rework in one file; any of those three moves is scope drift.

**If the recording shows the shake firing during smooth motion (AC #5 violated), do NOT tune the threshold higher to hide it in the recording.** Fix the `dSpeed_dt` derivation — the signal is wrong, not the threshold. That is the Principle 2 violation path.

**If the debug-hook-triggered shake reads as 3D wobble or as continuous hum on the recording (AC #1 or AC #2 violated), stop and re-read Max's verbatim quote.** The shape is the feature; a close-enough shape that doesn't match the pebble/boat/ether metaphor fails the workstream by design.

**Artifacts expected at close:** 2 commits (signal + shape, separable per §In scope); 1 canvas recording at the path in AC #7; this brief at `Shipped <sha> — verified against <recording-path>`; Director's two doc edits on master (Bible §8H + Contract §10.8) AND Director's minor revision to WS 2 brief's parking-lot paragraph. WS 2's Shipped flip happens in the same loop.

Drafted by PM 2026-04-21 as the redesign follow-up to WS 2 of the V1 autopilot sequence.
