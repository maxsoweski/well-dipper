# Workstream: Autopilot gravity-drive shake redesign — single-axis logarithmic impulse train (2026-04-21)

## Status

`VERIFIED_PENDING_MAX 34d6d98` — round-10 code committed. Rotation-only sustained tremor, signal-gated to TRAVELING phase with belt-and-suspenders sampling gate. Canonical surface change (camera.position is never mutated by shake — quaternion post-multiply after lookAt).

**Self-audit results (all four telemetry ACs passed programmatically before recording surfaced):**
- AC #16 `orbitCrossProduct`: PASS (0 violations — no shake during orbiting/approaching phases)
- AC #17 `signalCoincidence`: PASS (0 violations — no shake outside signal window; debug fires excluded as authored)
- AC #18 `envelopeFitsPhase`: PASS (0 violations — no event extends past TRAVELING phase)
- AC #19 surface-invariant (code grep): PASS — only documentation comments reference `camera.position` in shake context; no code path writes to it from shake.

**Recording drop paths:**
- `screenshots/max-recordings/autopilot-shake-redesign-round10-2026-04-21.webm` — Sol D-shortcut tour with debug-fire pair embedded. Short recording (~40s wall, ~322KB on disk) — Well Dipper's canvas only re-renders during active motion/shake, so the recorded frames are the motion moments only. Shows orbit silence + short-hop silence + debug-triggered accel/decel tremor.

**Natural long-leg evidence gap:** The Sol D-shortcut tour path is all short-hop legs (`isShortTrip=true` throughout), so no natural accel/decel events fired during the capture. The code path is in place (phase-gate + signal derivation + onset detection); a Sol warp-arrival tour would hit the natural decel path at ENTRY→APPROACH — that capture failed to trigger warp in this session (debug-shortcut interaction with warp flow). Director may flag this as a remaining observational gap vs. code-verified gap.

**Tunable constants** (per Max's "configurable so we can adjust" ask — all at top of `src/auto/ShipChoreographer.js`):
- `TREMOR_ENVELOPE_DURATION = 1.5` seconds
- `TREMOR_PITCH_PEAK_DEG = 1.0`, `TREMOR_YAW_PEAK_DEG = 1.0`, `TREMOR_ROLL_PEAK_DEG = 0.5`
- `PITCH_FREQ_HZ = 20`, `YAW_FREQ_HZ = 22`, `ROLL_FREQ_HZ = 19` (detuned per axis)
- `SIGNAL_ONSET_THRESHOLD = 35.0`, `SIGNAL_EVENT_COOLDOWN = 0.5`, `SIGNAL_SMOOTHING = 0.15`

Each constant has inline docs naming its role, V1 seed rationale, and bounded range. Max tunes via F12 during review.

Awaiting Max's verdict.

---

**Historical: HELD state (superseded by round-10 code commit 34d6d98).**

`HELD — ROUND 10 PIVOT (rotation-only sustained tremor, signal-gated to traveling phase)` — Director REJECTED round-9 (`992cbb2`) after Max watched all three recordings. Telemetry-as-spec passed; the felt experience failed on three concrete bugs plus a fundamental reframe (quotes reproduced in §"Round-10 amendment" below). Round-9's VERIFIED_PENDING_MAX block is retired in full — it's retained under §"Historical: round-9 (superseded by round-10 pivot)" for audit-trail continuity. Gate is engaged; code does not resume until Director re-audits this amendment.

**What round-10 changes — in one sentence.** Retire the phase-boundary one-shot trigger and the 4–5-bounce discrete log-impulse envelope; replace with a continuous `|d|v|/dt|` signal phase-gated to `phase === 'traveling' && !legIsShort`, driving a **1–2 second subtle sustained tremor** on a **high-frequency small-amplitude carrier** applied as **rotation-only** offsets (pitch/yaw/roll quaternion delta) to the camera AFTER the `lookAt` composition — fixing both Max's "shaking at wrong moment" timing critique (fires DURING sharp motion, not at the boundary that ends a travel segment) and his "planets are bouncing" surface critique (camera rotation leaves framed geometry fixed in world-space; only the viewport heading judders).

**What round-10 preserves from round-9.**
- `!legIsShort` gate — the existing `NavigationSubsystem._isShortTrip` (line 357) stays as the distance discriminator; shake still silent on short hops.
- `legIsWarpExit` carve-out — warp-exit legs still fire no accel-window tremor (portal pre-loaded cruise speed; no sharp-accel event); decel window on arrival fires normally per §8H line 1309.
- `motionFrame.legIsShort` / `motionFrame.legIsWarpExit` MotionFrame extension (round-9's authorized cross-file edit) — retained; round-10 also reads them.
- `debugAccelImpulse()` / `debugDecelImpulse()` debug entry points — retained but re-shaped: each now enqueues a 1.5s tremor event of the correct envelope shape rather than starting a log-impulse train. Debug fire remains unconditional (bypasses gates per round-9's scaffolding convention).
- `window._autopilot.telemetry` capture shape — extended, not replaced (see AC #16 below for the four new telemetry-invariant fields).
- Round-4 drift-risk-2 `cam2tgt` freeze-at-onset invariant — no longer materially applicable (rotation-only surface doesn't scale to scene-unit offsets), but the principle carries: any per-event parameter that needs freezing is frozen at onset atomically in `_startTremorEvent()`.

**What round-10 retires from rounds 8/9 (verbatim, for bisect readers).**
- `ACCEL_AMPS = [0.30, 1.00, 0.70, 0.35, 0.10]` — dead. Crescendo-fade now lives as a **continuous amplitude envelope** over the tremor carrier, not a 5-element discrete-bounce array.
- `DECEL_AMPS = [1.00, 0.55, 0.30, 0.17]` — dead. Impact-decay now lives as a continuous amplitude envelope over the tremor carrier.
- `IMPULSE_INITIAL_GAP = 0.08`, `IMPULSE_SPACING_RATIO = 1.8` — dead. No log-spacing; tremor has a carrier frequency, not inter-bounce gaps.
- Gaussian bump per bounce — dead. Replaced by the carrier's natural sinusoidal (or filtered-noise) shape.
- `SHAKE_VIEW_ANGLE_MAX = 0.05` as peak impulse-view-angle — dead in that role. Peak view angle per-axis is now a small rotation tunable (suggested V1 seed: 0.5–1.5° per axis, Max-tunable — see §Round-10 scope for the exposed constant surface).
- `_shakeOnsetCam2Tgt` — dead. Rotational shake doesn't need a distance scale; scale-coupling was a scene-unit-translation artifact.
- `_shakeOnsetSign` — dead. The signed signal directly shapes the amplitude envelope; no sign-branch at envelope pick time.
- `shakeOffset` Vector3 position-offset API on ShipChoreographer — **retired or repurposed** (working-Claude picks). New API is a rotation quaternion or Euler-triple; FlythroughCamera composes it into `camera.quaternion` AFTER `lookAt`, not into `camera.position`. Named explicitly so working-Claude does not reflexively preserve the old name.

Awaiting Director re-audit of this amendment.

---

**Historical: round-9 (superseded by round-10 pivot).**

Round-9 closed at `VERIFIED_PENDING_MAX 992cbb2` — phase-boundary triggers gated on `!_isShortTrip` with warp-exit accel carve-out. Telemetry self-audit passed all AC #3/#13/#14/#15 invariants (debug accel: 5 crescendo-fade peaks log-spaced; debug decel: 4 impact-decay peaks; natural Sol tour 27s all `isShortTrip === true`, zero auto-fires; STATION sampling zero shake 60+ frames; warp-exit path verified — ENTRY coast silent, decel fires at `travelComplete` into first-body orbit). Three recordings at the drop paths below. Max's verdict: *"awful, way off the mark"* — concrete bugs:

1. Shake fires when the ship reaches the moon (end of a leg, not DURING the sharp-motion event).
2. Violent shake persists while the ship is orbiting the moon ("a dog with fleas shaking its head").
3. Shake fires right as the ship comes to a stop in front of a star ("a car hitting the brakes").

Plus a felt-experience reframe load-bearing for round-10: *"it happens AS THE SHIP DECELERATES OR ACCELERATES SHARPLY. So it wouldn't shake while in orbit around a moon, or right at the point when the trajectory toward the star is almost slowed to a stop. And besides — the overall effect looks comedic, it's like the planets are bouncing around. Is the ship shaking? Because it's should just be a little judder happening in the camera — as if the player is experiencing turbulence, not as if the ship is on a rubber band attached to a zipline."*

**Round-9 recording drop paths (retained for archival / round-10 before-state):**
- `screenshots/max-recordings/autopilot-shake-redesign-round9-2026-04-21.webm` (9.9 MB, 27s)
- `screenshots/max-recordings/autopilot-shake-redesign-round9-envelope-demo-2026-04-21.webm` (3 MB, 11s)
- `screenshots/max-recordings/autopilot-shake-redesign-round9-warpexit-2026-04-21.webm` (9.1 MB, 25s)

**Why round-9 telemetry missed the felt-experience failure.** The telemetry asserted that the code did what the round-9 brief said — and it did. What the spec did *not* assert: (a) shake-envelope duration must complete before the next phase transition (round-9 envelope ~1.9s rings out into APPROACHING/ORBITING on small bodies); (b) `shakeOffset > ε` must not overlap any frame where `phase ∈ {'orbiting', 'approaching'}` (the round-9 test sampled these independently, never crossed them); (c) shake must coincide with sharp-motion signal, not fire AFTER it (Hermite-ease `|d|v|/dt|` peaks mid-segment at `t ∈ [0.3, 0.7]`, not at `t=1` where `travelComplete` fired round-9's decel); (d) surface must be rotation not translation (a 2.86° view-angle offset applied as world-Y position shifts every framed object, reads as rubber-band not judder). Round-10 encodes all four as telemetry-invariant ACs that run programmatically against a capture — see §Round-10 ACs #16–#19.

---

**Historical: HELD state (superseded by round-9 code commit 992cbb2, itself superseded by round-10 pivot).**

`HELD — ROUND 9 PIVOT (phase-boundary events, short-hop silenced, warp-exit coast)` — Director HELD the workstream after Max rejected round-8's continuous-`d|v|/dt`-onset firing model on 2026-04-21. Round-8 closed at `VERIFIED_PENDING_MAX 46ca75e`; that block is retained below as "Historical: round-8 (superseded by round-9 pivot)." Gate is engaged; code does not resume until Director re-audits this amendment.

**What round-9 fixes.** Round-8 restored the Bible §8H asymmetric log-impulse envelope and passed its own telemetry ACs — but when Max watched the full tour recording, the continuous `|d|v|/dt|`-onset model caught real-but-not-dramatic speed changes. Orbit-phase pitch modulation + breathing + arrival-distance settle each produced small `|d|v|/dt|` spikes that fired the onset detector; shake bled into orbit where it doesn't belong. The signal-driven mental model is fundamentally wrong for what Max wants: he wants shake ONLY on dramatic accel/decel between distant objects, not on any speed-change event the math can legitimately detect.

**Max's ruling (2026-04-21, verbatim):**

> *"what matters is that this shaking/rumbling should only happen when accelerating or decellerating dramatically. Only then. This will not happen in orbit, only when blasting off from one system object to another, if far enough apart. Let me know if you have questions about this."*

**Max's Q&A follow-up (three questions surfaced by Director's first round-9 direction pass, 2026-04-21):**

- **Q1 (distance gate metric).** *"If we have to travel sufficiently close to the speed of light and accelerate to that speed sufficiently fast (or vice-versa), then there's turbulence."* Long legs → ship reaches near-c → sharp accel/decel → shake. Short hops → ship never gets there → no shake. Operationalization delegated.
- **Q2 (additional qualifier).** Q1 answers Q2; no second qualifier needed.
- **Q3 (warp exit).** *"Remain at constant speed when exiting portal, until we slow down to get into the star's orbit."* No accel at ENTRY start (portal handed the ship its cruise speed already). Decel fires at arrival into the first body's orbit, same as any other arrival.

**Director operationalization (delegated by Max, captured in the audit's §Round-9 PM direction).**

- **"Sufficiently long leg" = `!_isShortTrip`.** `NavigationSubsystem._isShortTrip = dist < Math.max(_currentDist * 5, 30)` at line 357 is already the canonical short/long discriminator inside the subsystem that produces these legs. Reuse it — no new threshold, no new constant.
- **Accel fires** on the frame `NavigationSubsystem` enters `TRAVELING` for a leg where `!_isShortTrip` AND `warpExit === false`.
- **Decel fires** on the frame `travelComplete` one-shot raises for a leg where `!_isShortTrip` (warp-exit arrival included — the warp-exit distinction lives only on the accel side).

**What round-9 preserves from round-8 (load-bearing, do NOT re-derive).**

- Envelope arrays verbatim: `ACCEL_AMPS = [0.30, 1.00, 0.70, 0.35, 0.10]` (crescendo-then-fade, 5 bounces) and `DECEL_AMPS = [1.00, 0.55, 0.30, 0.17]` (impact-then-decay, 4 bounces).
- Log-spaced impulse timing: `IMPULSE_INITIAL_GAP = 0.08`, `IMPULSE_SPACING_RATIO = 1.8`.
- Gaussian bump shape per bounce.
- Single-axis shake perpendicular to velocity (AC #1).
- Atomic `_startImpulseTrain()` freezes `_shakeOnsetCam2Tgt` + event-type flag + `_shakeOnsetTime` + axis vector at event fire. No per-frame re-scale of `cam2tgt` — round-4 drift-risk 2 invariant still canon.
- `debugAccelImpulse()` / `debugDecelImpulse()` distinct entry points; both ignore `_isShortTrip` and `warpExit` gates (debug fire = unconditional).
- `_pendingDebugFire` mechanism that lets debug hooks enqueue an event for the next update tick.

**What round-9 removes from round-8 (retire entirely).**

- `ONSET_THRESHOLD` constant — no more "is `|d|v|/dt|` above X" check. Events fire from phase transitions, not signal crossings.
- `ONSET_REFRACTORY` window — phase transitions are naturally one-shot per leg; no refractory needed.
- `subThreshold` timer — dead with the threshold.
- The signal-driven onset path in `ShipChoreographer.update()` that reads continuous `dSpeed`, smooths it, compares to threshold, and calls `_startImpulseTrain` autonomously. Deleted. `_startImpulseTrain` becomes callable only by (a) phase-transition listener, (b) `_pendingDebugFire` consumer.
- `_signedDSpeed` as envelope discriminator — replaced by the event type itself (the firing code path knows whether it's accel or decel by which branch called it). If `_signedDSpeed` is kept at all, it's as logged telemetry only, not as a trigger input.
- Continuous `dSpeed` smoothing math if unused elsewhere (PM notes: working-Claude checks; if it's only feeding the deleted onset detector, remove it).

**Per-phase firing rules (table, authoritative):**

| Phase transition | Leg condition | Event fired |
|---|---|---|
| → `TRAVELING` (ordinary depart from orbit) | `!_isShortTrip && !warpExit` | ACCEL envelope |
| → `TRAVELING` (warp-exit coast) | `!_isShortTrip && warpExit === true` | **No event.** Ship is already at cruise speed; portal did the acceleration. |
| `travelComplete` (arrival into orbit/approach) | `!_isShortTrip` (any leg type, warp-exit or ordinary) | DECEL envelope |
| Any boundary | `_isShortTrip === true` | **No event.** Short hops silent. |
| `ORBITING` (any sub-state) | — | **No event, by construction.** Orbit phase is not an event surface at all; the trigger mechanism cannot fire here regardless of what continuous signals would report. |

**Bible §8H stays as written.** Per Director's re-read: §8H line 1303 already names "warp-exit velocity mismatch" and "a transition that exceeds the drive's smoothing capacity" as firing conditions — phase boundaries on long legs are exactly those transitions. Line 1304: "Shake magnitude is a function of motion-abruptness (motion discontinuity), not an authored per-moment effect" — phase boundaries ARE motion discontinuities under the event model. Line 1307 canonizes the asymmetric accel-vs-decel lore (round-9 preserves both envelopes). Line 1309 explicitly canonizes decel-at-arrival: *"the friction-against-ether event is the arrival event itself, because that is where the drive exerts its compensation impulse."* This is the decel gate verbatim — Max's Q3 answer (decel at orbit entry, not portal exit) is already Bible canon.

Round-9 is the more faithful implementation of what §8H already says. Rounds 6–8's continuous-signal mental model was itself the reading that diverged from §8H. No Bible edit is required — future readers of this brief should not re-open the question.

---

**Historical: round-8 (superseded by round-9 pivot).**

Round-8 closed at `VERIFIED_PENDING_MAX 46ca75e` — the Bible §8H asymmetric log-impulse envelope was restored on a continuous `d|v|/dt` onset-detection trigger. Director re-audit at `755000e` RELEASED the gate scoped to `ShipChoreographer.js`; code commit `46ca75e` was that scoped work. Max watched the recording and rejected the continuous-signal firing model because it fired shake during orbit (pitch modulation / breathing / arrival settle produce legitimate but not-dramatic `|d|v|/dt|` events). Round-9 retires the signal-driven trigger entirely in favor of phase-boundary events gated on `!_isShortTrip`. The envelope-shape work from round-8 (AMPS arrays, timing constants, Gaussian bumps, atomic onset freeze) carries forward verbatim; only the trigger surface changes.

Round-8 telemetry at the time it closed:
- Accel envelope (cam2tgt=187.7 at ENTRY, peakAmp=9.39): peaks 3.04 / 9.70 / 6.75 / 3.36 / 0.96 at t=0.08 / 0.22 / 0.48 / 0.94 / 1.79 s. Within 3% of `ACCEL_AMPS × peakAmp` = [2.82, 9.39, 6.57, 3.28, 0.94].
- Decel envelope (cam2tgt=100, peakAmp=5.0): peaks 5.06 / 2.83 / 1.54 / 0.87 at t=0.08 / 0.22 / 0.48 / 0.95 s. Within 3% of `DECEL_AMPS × peakAmp` = [5.00, 2.75, 1.50, 0.85].
- Recording at `screenshots/max-recordings/autopilot-shake-redesign-round8-2026-04-21.webm` (3.4 MB, 11.5s). Contact sheet at `...-round8-2026-04-21-contactsheet.png`.

Those telemetry numbers remain a valid shape-verification artifact for round-9's envelope math — the envelope did not regress at round-8, the trigger did.

---

**Historical: round-8 HELD state (superseded by round-8 code commit 46ca75e, now itself superseded by round-9).**

`HELD — ROUND 8 PIVOT (path A, restore canon)` — Director HELD the workstream at `8a21830` after auditing round-7. Audit at `~/.claude/state/dev-collab/audits/autopilot-shake-redesign-2026-04-21.md`. Gate is still engaged; code does not resume until Director re-audits this amendment.

**The problem.** Rounds 6 and 7 silently replaced the Bible-canonical asymmetric log-impulse envelope with a continuous sinusoidal bob (`Math.sin(_timeAccum × 6Hz × 2π) × smoothed amplitude`, `Math.abs(dSpeed)` discarding sign). AC #2 (3–5 discrete bounces, log-spaced, log-decaying) and AC #4 (accel vs. decel visibly asymmetric) went to zero in code while still live in the brief. Neither pivot went through PM or Director. The round-6 Status block retroactively framed the continuous-drive shape as the intent; it wasn't — it was unauthorized abandonment of the envelope work that had been in flight since round-1.

**Max's round-5 verdict** — *"rumble is still all weird and happens all at the end once we're already in orbit ... this should be an effect that is applied based on how quickly the velocity of the ship changes"* — corrects the **signal source** (fire continuously from `d|v|/dt`, not from phase-boundary one-shots). It does not rewrite Bible §8H's asymmetric-impulse-train canon, which Max co-authored the same day in commit `cde2d7f`. Round-6 did a double pivot: signal-source fix (authorized, correct) + envelope-shape replacement (unauthorized, wrong). The double pivot is the drift.

**Path A — restore canon (this round).** Do NOT escalate canon-change to Max; there is no basis for Path B in Max's feedback and Bible §8H (lines 1307–1309) is active canon. Round-8 restores the asymmetric log-impulse envelope on top of round-6's correct continuous `d|v|/dt` signal source. The two are compatible: the signal says "how fast is `|v|` changing right now," and the envelope fires a discrete asymmetric bounce-train event each time that signal crosses an onset threshold. The continuous drive is the *trigger condition*, the log-impulse train is the *shape of the response*. They are not competing shapes; round-6/7 collapsed them into one because the brief's Status block authorized doing so. It should not have.

**Round-8 scope (for working-Claude, gated on Director re-audit):**

1. **Preserve from round-6/7:**
   - Continuous `|d|v|/dt|` derivation in `ShipChoreographer.update()` lines 192–210 (position-delta → velocity → scalar speed → `dSpeed = (currSpeed - _prevSpeed) / dt`). Signal-source fix is correct; Max's round-5 feedback authorizes it.
   - `DSPEED_SMOOTHING = 0.15` low-pass filter on the raw signal (round-6 addition — rejects per-frame noise without crippling responsiveness). Keep.
   - Sign tracking in `_signedDSpeed` (round-6 kept it as debug-only — round-8 promotes it back to the accel/decel discriminator per AC #4).
   - The `cam2tgt`-based view-angle scaling approach for computing per-impulse peak amplitude from a target view-angle — round-7's insight that `orbitDistance` during CRUISE refers to the upcoming orbit rather than the current framing is correct, and the fix (scale by live camera-to-target distance) survives. **Caveat per round-4 drift risk 2 / audit §Round-7 tuning:** the scale factor must be **frozen at impulse onset**, not re-read every frame. Round-7 re-reads `cam2tgt` every frame at line 244 and that regresses the round-4 drift-risk guard. Round-8: at the frame where a new impulse-train event fires, read `cam2tgt` *once*, store it as `_shakeOnsetCam2Tgt`, use that stored value for every subsequent frame of the event's envelope.

2. **Revert from round-6/7:**
   - Continuous sinusoidal bob at line 252 (`carrier = Math.sin(_timeAccum × BOB_FREQUENCY × 2π)`). Deleted.
   - `Math.abs(dSpeed)` at line 206 discarding sign. Preserve the signed `dSpeed` through to the envelope-fire decision — the sign of `dSpeed` at onset selects the accel envelope (crescendo-then-fade) or the decel envelope (impact-then-decay) per AC #4.
   - `BOB_FREQUENCY`, `SECONDARY_AXIS_RATIO`, `SHAKE_MAX_AMPLITUDE = 20.0` as constants for a continuous bob. Replaced by the impulse-train constants (see below).
   - The framing that the shake is a "continuous function of amplitude" per-frame. That framing is what authorized the envelope replacement; it has to be removed explicitly so the code-comment canon matches the Bible.

3. **Restore from rounds 1–5 (per audit §Acceptance condition for next iteration, path A):**
   - Asymmetric impulse-train precompute at event onset: `ACCEL_AMPS = [0.30, 1.00, 0.70, 0.35, 0.10]` (crescendo-then-fade, per §In scope and Bible §8H "ship pushing INTO medium from rest — waves build then release"); `DECEL_AMPS = [1.00, 0.55, 0.30, 0.17]` (impact-then-decay, per §In scope and Bible §8H "ship slamming into wall of accumulated medium — impact first then rings out").
   - Log-spaced impulse timing: `Δt_n = Δt_0 · φ^n` with `IMPULSE_INITIAL_GAP = 0.08` and `IMPULSE_SPACING_RATIO = 1.8` (round-1 values — Max did not flag these as wrong).
   - Onset-detection on the signal: fire a new impulse-train event when smoothed `|d|v|/dt|` crosses a low onset threshold after a period at zero. The continuous signal is the trigger *mechanism*; the envelope is the *shape*. Once fired, the event runs its precomputed ringout regardless of subsequent signal values — events don't re-fire mid-ringout. A new event can fire only after the prior event completes AND the signal has been below onset threshold for a refractory window (suggested ≥100ms; working-Claude picks and cites).
   - Axis freeze at onset: per drift risk 1 guard in §Drift risks — world-Y primary (boat-bob), `SECONDARY_AXIS_RATIO = 0.20` horizontal-perpendicular companion. Both axes carry the same envelope, synchronized, frozen at onset.
   - Per-event peak amplitude `peakAmp = viewAngleTarget × _shakeOnsetCam2Tgt` where `viewAngleTarget` is a bounded tunable (suggested V1: reuse `SHAKE_VIEW_ANGLE_MAX = 0.05` rad from round-7 — tuning stays available but now scales the impulse peak, not a continuous carrier). The envelope arrays multiply through `peakAmp` at precompute so downstream per-frame sampling is a lookup.

4. **Preserve round-3 arrival-timing (AC #8) and round-4 scale-coupling invariant (AC #10 drift risks 1 & 2).** Neither was wrong — both were silently deprecated when the continuous-bob shape replaced the impulse-train shape. Round-8 brings both invariants back with the shape that needs them. Specifically: at onset, freeze `_shakeOnsetCam2Tgt` AND `_shakeOnsetSign` AND `_shakeOnsetTime` AND the axis vector as one atomic `_startImpulseTrain()` operation; the envelope runs on those frozen values for its full ringout.

**ACs #2 and #4 are reaffirmed, not rewritten.** They were always correct and always Bible-aligned:

- **AC #2 reaffirmed** — log-impulse envelope, 3–5 discrete bounces, log-spaced timing, log-decaying amplitude. `shakeOffset.length()` traces discrete peaks over time, not a continuous sinusoidal carrier. (Bible §8H: *"waves build against the hull as it breaks through, then release"* + *"impact hits first, then rings out"* — both describe discrete-event shapes.)
- **AC #4 reaffirmed** — accel pattern (crescendo-then-fade) and decel pattern (impact-then-decay) visibly, temporally asymmetric. Different amplitude sequences; discriminator is `sign(dSpeed)` frozen at onset. (Bible §8H: *"they are different physical events against the same medium"* — asymmetry is the canon, not a tuning choice.)

**What the round-8 commit produces:**

- One commit titled `feat(autopilot): restore asymmetric log-impulse envelope on continuous d|v|/dt trigger (round 8)`. Scope: revert the continuous-bob code at lines 222–269; reinstate the round-5-era precomputed impulse-train state (`_shakeAmps`, `_shakeImpulseTimes`, `_shakeOnsetTime`, `_shakeOnsetCam2Tgt`, `_shakeOnsetSign`, `_shakePrimaryAxis`); add onset-detection on smoothed `|d|v|/dt|` with a refractory window; wire the sign → envelope-array pick; restore `debugAccelImpulse()` and `debugDecelImpulse()` as distinct debug hooks (round-6 collapsed both to `debugAbruptTransition()` — reverse per §In scope AC #4 guard).
- One canvas recording at `screenshots/max-recordings/autopilot-shake-redesign-round8-2026-04-21.webm`. Sol, debug sequence: smooth baseline (~3s) → `debugAccelImpulse()` → smooth gap (~2s) → `debugDecelImpulse()` → smooth closer (~2s). Working-Claude captures, surfaces contact sheet + two frames (mid-accel-envelope, mid-decel-envelope), Max evaluates asymmetry on playback.
- Round-8 telemetry probe (post-commit, in-browser): read `_signedDSpeed` + `shakeOffset` at ~10 Hz across a debug-triggered event, confirm `shakeOffset.length()` profile shows 3–5 discrete peaks (not continuous oscillation) and that peaks #2-N decay log-style relative to peak #1. This is working-Claude self-audit, not the Shipped artifact.

**Gate release condition.** Director re-audits this amendment, confirms the round-8 plan restores Bible §8H asymmetric-impulse-train canon + preserves round-6's correct signal source + honors the round-4 scale-freeze invariant, and releases the gate for the specific edits named in the scope above. Working-Claude does NOT edit code until Director audit lands.

**What round-8 does NOT do:**
- Does not edit Bible §8H. Canon is fine as-is; code was the drifted thing.
- Does not edit §10.8. Same reason.
- Does not reopen AC #2 or AC #4. They were correct; the code regressed against them.
- Does not re-tune any constant outside the round-8 scope. No speculative tuning passes until the restored-canonical-shape recording clears Max.
- Does not retain round-7's multi-variable tune. The four simultaneous changes to `DSPEED_DEADZONE`, `DSPEED_FULL_SCALE`, `SHAKE_VIEW_ANGLE_MAX`, `SHAKE_MAX_AMPLITUDE` read as tuning on the wrong shape. Round-8 starts from the round-5 envelope constants with the one round-7 insight carried forward (`cam2tgt` scale, but frozen at onset).

**History preserved for readers of this brief:** the round-6 and round-7 status blocks below remain verbatim as record of the drift arc — they are not deleted, but they no longer describe the intended design. The design is, and always was, Bible §8H's asymmetric log-impulse-train shake.

---

**Historical status (superseded by round-8 pivot above — retained for audit trail):**

`VERIFIED_PENDING_MAX d02db8f` — **round-7 amplitude retune on round-6 mechanism.** Max on round-6 ("I don't see any shake at all now"). Diagnosis (at the time, later corrected by Director audit): mechanism right, amplitude below perceptual floor.

**Round-7 fixes (tuning-only; mechanism unchanged at the time):**
1. **Scale coupling `orbitDistance` → `cameraToTargetDistance`.** During CRUISE the camera sits 20-200 scene-units from the target while `orbitDistance` refers to the upcoming orbit (moon=0.06). `amp = viewAngle × orbitDist` gave 0.0007-unit offsets vs. 30+-unit view distances = ~0.002° view swing (invisible). Swapping to `cam2tgt` makes view-angle uniform across all phases. **Round-8 keeps this insight but freezes `cam2tgt` at impulse onset** (round-7 re-read it every frame, which regresses the round-4 drift-risk 2 guard).
2. **Thresholds retuned to observed signal range.** Typical `|d|v|/dt|` peak during Sol tour ~180 scene-units/s². `DSPEED_DEADZONE 20 → 5`, `DSPEED_FULL_SCALE 300 → 150`. **Round-8: these thresholds now feed onset-detection for the impulse train, not a continuous carrier — retune if needed against event-firing cadence.**
3. **Peak view angle `SHAKE_VIEW_ANGLE_MAX 0.02 → 0.05 rad`** (1.15° → 2.86°). The 1.15° cap was below the perceptual floor on a 6 Hz carrier. **Round-8: retained as the `viewAngleTarget` for per-impulse peak amplitude calculation.**
4. **Absolute cap `SHAKE_MAX_AMPLITUDE 2.0 → 20.0`** to accommodate new cam2tgt-scaled magnitudes. **Round-8: role changes — becomes an impulse-peak ceiling, not a continuous-bob amplitude cap.**

**Prior round-6 intent (DEPRECATED round-8):** continuous `|d|v|/dt|`-driven amplitude, no impulse trains, no phase-boundary triggers. The "no impulse trains" clause was unauthorized — Bible §8H and ACs #2/#4 canonize the impulse-train shape. The "no phase-boundary triggers" clause remains correct (round-6's signal-source fix is preserved in round-8).

**Round-6 telemetry evidence (superseded):** CRUISE shake peak 0.00090 scene-units — numerically correct for the tuning but visually nil. Round-7 expected peak at same drive level: `0.05 × cam2tgt(30) = 1.5` scene-units (~1600× more), view angle 2.86° at drive=1. **Neither round's telemetry evaluated the impulse-train shape, because neither round implemented it.**

---

**Historical: round-6 mechanism block.** After round-5 failed Max's verdict ("rumble is still all weird and happens all at the end once we're already in orbit ... this should be an effect that is applied based on how quickly the velocity of the ship changes"), the impulse-train model was abandoned wholesale. Rounds 1-5 fired discrete impulse trains at phase boundaries; round-6 drives shake amplitude **continuously from smoothed `|d|v|/dt|`** — shake is a direct function of how fast the ship's speed is changing, not a one-shot event tied to a phase transition.

**Historical note** (rounds 1-5): the impulse-train model struggled through 5 rounds of increasing amplitude and timing fixes because the model itself was wrong for what Max wanted. Director audit (2026-04-21, post-round-5): `atan(shakeOffset/orbitDistance) ≈ shakeOffset/orbitDistance` for small angles, so scale-coupling via `SHAKE_AMPLITUDE_FRACTION * orbitDistance` produces a per-body-class-UNIFORM view-angle swing of `SHAKE_AMPLITUDE_FRACTION` radians per bump. `FRACTION=0.10` meant 5.7°/bump everywhere; 4 alternating-sign decel bumps in <1s = whip-crack camera rotation. Round-6 continuous-drive eliminates both problems structurally.

**Round-5 fixes (both tuning-level — no scope change):**
1. `SHAKE_AMPLITUDE_FRACTION = 0.10 → 0.02`. Peak view angle per bump: **5.7° → 1.15°**. Reads as camera tremor, not whipsaw.
2. Decel envelope: sign-alternation suppressed. Accel bumps still alternate (pebble-skip metaphor); decel bumps are now monotonic impact-then-settle (boat-slam-into-wall metaphor). Matches the round-1 design intent.

**Post-round-5 verification** (pathological-case moon trigger, 20ms sampling):
- peak shake magnitude: 0.00122 scene units (was 0.0038 at round-4)
- peak view angle: **1.17°** (was 5.72° at round-4)
- Y-swing range: 0.00120 (all positive samples — monotonic decel confirmed)

Recording at `screenshots/max-recordings/autopilot-shake-redesign-round5-2026-04-21.webm` (12.8 MB, ~30s, natural moon arrival + per-body debug impulses). Awaiting Max's verdict.

**Round-3 telemetry evidence (34s Sol capture, post-`64a7725`):**
- **Decel fires at arrival, not halfway.** Phase transition `approaching → orbiting` at t=19.71s; decel impulse fires at t=19.78s (70ms after arrival). AC #8 verified.
- **Sustained orbit = zero shake.** 4.4s window of STATION (t=20.6 to t=25.0): zero shake events. Residual-wobble hypothesis from round 2 disproven.
- **CRUISE + APPROACH = zero shake.** 2623 CRUISE samples + 971 APPROACH samples all at `shakeMag=0`.
- **Debug hooks fire correctly.** `debugAccelImpulse()` at t=25.07s triggers crescendo-then-fade; `debugDecelImpulse()` at t=29.07s triggers impact-then-decay.

**Commit arc (3 commits):**
- `7a7370f` — `feat(autopilot): single-axis log-impulse shake per Max's pebble/boat/ether design` — first redesign pass. Log-spaced impulse train, asymmetric accel/decel amplitude envelopes, scalar-`d|v|/dt` trigger, two new debug hooks.
- `deb5056` — `tune: threshold 40→10000` — first tuning pass; Hermite cruise was still firing on threshold-based gate.
- `8a9161f` — `fix: vertical-axis shake + phase-boundary trigger per Max's 2026-04-21 feedback` — round-2 redesign after Max watched first recording: (a) primary axis flipped from horizontal-perpendicular to **world Y** (boat bobbing up-and-down, not side-to-side); (b) added secondary horizontal-perpendicular axis at 20% amplitude carrying the SAME envelope (synchronized minor companion shake); (c) replaced threshold gating with **phase-boundary detection** — shake fires at `motionStarted && phase === 'traveling'` (begin-accel) and `travelComplete` (begin-decel), nowhere else. Sustained smooth motion no longer gates on a magnitude threshold; the discontinuity-onset is the trigger. Removed obsolete `_abruptnessThreshold`/`_abruptnessMax`/`_dSpeedDt`/`_prevSpeed`/`_hasPrevSpeed`/`ONSET_TRIGGER_THRESHOLD`.

**Recording (drop path):** `screenshots/max-recordings/autopilot-shake-redesign-2026-04-21.webm` (6.4 MB, 14s). 4-segment sequence per AC #7: smooth baseline (3s — possibly includes a natural travelComplete decel impulse if the autopilot crosses a phase boundary in this window) → `debugAccelImpulse()` fires (4s — accel envelope ringout, vertical bob with minor companion sway) → smooth gap (2s) → `debugDecelImpulse()` fires (5s — decel envelope ringout, vertical bob with minor companion sway). Captured at Sol via non-warp `_startFlythrough()` engage. Recorded against commit `8a9161f` (round-2 redesign).

**Director-owned doc edits already landed (2026-04-21):**
- Bible §8H Gravity Drive — ether metaphor extension paragraph (commit `cde2d7f`).
- SYSTEM_CONTRACTS §10.8 — trigger refined to scalar `d|v|/dt`; envelope refined to log-impulse train; accel/decel asymmetry formalized (commit `cde2d7f`).
- WS 2 brief §"Parking-lot — shake redesign" — updated to link forward to this brief; Shipped-flip gate updated to require BOTH recordings approved by Max (commit `cde2d7f`).

**Telemetry probes** (post-`8a9161f`, pre-recording, in-browser via chrome-devtools):
- Smooth tour baseline (CRUISE phase, 2s sample): all shake offsets = 0. AC #5 invariant preserved.
- Natural phase-boundary fire at autopilot's travel→approach transition: shake fires with `sy = -0.312` (PRIMARY: vertical bob), `sz = 0.062` (SECONDARY: horizontal-perp, 20% of primary, synchronized), `sx = 0.002` (negligible — depends on velocity orientation at onset). Vertical-axis dominance confirmed.
- Subsequent samples in the impulse train decay log-shaped (mag 0.319 → 0.065 across 800ms).

**Tuning note for Max:** the trigger is now phase-boundary-only (no threshold knob). Tunables at the top of `src/auto/ShipChoreographer.js`:
  - `IMPULSE_SPACING_RATIO = 1.8` — log-spacing growth ratio (φ; >1 → gaps grow each impulse)
  - `IMPULSE_INITIAL_GAP = 0.08` — seconds from onset to first impulse peak
  - `IMPULSE_WIDTH_RATIO = 0.5` — bump width as fraction of leading gap (controls how sharp/blurry each bump reads)
  - `ACCEL_AMPS = [0.30, 1.00, 0.70, 0.35, 0.10]` — accel envelope (crescendo-then-fade)
  - `DECEL_AMPS = [1.00, 0.55, 0.30, 0.17]` — decel envelope (impact-then-decay)
  - `SHAKE_MAX_AMPLITUDE = 0.6` — primary-axis (Y) magnitude scale
  - `SECONDARY_AXIS_RATIO = 0.20` — secondary-axis (horizontal-perp) magnitude as fraction of primary

If shake feels too punchy or too gentle, scale `SHAKE_MAX_AMPLITUDE`. If the secondary horizontal sway is invisible/distracting, scale `SECONDARY_AXIS_RATIO`. Envelope shape changes (asymmetry, bounce count) edit the AMPS arrays directly.

## Revision history

- **2026-04-21 — authored** by PM from Max's verbatim design direction 2026-04-21 (quote reproduced in §"Max's design intent" below) and Director's assignment for this follow-up loop.
- **2026-04-21 — Round 3 amendment** landed by PM on Director direction after Max's feedback on the round-2 recording (commit `8a9161f`). Adds AC #8 (arrival-timing decel trigger — fire on `approaching→orbiting` phase transition, not `travelComplete`) and AC #9 (telemetry recorder for programmatic state inspection). Flags §Round-3 director actions (Bible §8H arrival-compensation clause extension, SYSTEM_CONTRACTS §10.8 trigger-phase refinement). Orbit-phase wobble code stays out-of-scope pending post-fix telemetry capture — hypothesis is the orbit wobble is itself a symptom of the mistimed decel impulse, to be validated or disproved by AC #9's telemetry.
- **2026-04-21 — Round 4 amendment** landed by PM on Director direction after Max's feedback on the round-3 recording (commit `64a7725`, recording `screenshots/max-recordings/autopilot-shake-redesign-2026-04-21.webm`). Director-audited root cause: shake amplitude expressed in scene-unit absolutes against a 666× orbit-distance spread (Sol moon d=0.06 → star d=40) — a 0.6-unit world-Y bump is a minor nudge at the star and a view-flipping ±84° lurch at a moon. Adds AC #10 (amplitude scale-coupled to current-target orbit-distance, frozen at onset), AC #11 (multi-body stress-test telemetry — extends `window._autopilot.telemetry` samples with `currentTargetOrbitDistance`, `currentTargetBodyRadius`, `cameraToTargetDistance`, `currentTargetType`; adds `window._autopilot.debugArrivalAt('moon')` pathological-case entry point), AC #12 (round-4 recording MUST include at least one moon arrival at the drop path `screenshots/max-recordings/autopilot-shake-redesign-round4-2026-04-21.webm`). Flags §Round-4 director action (SYSTEM_CONTRACTS §10.8 scale-coupling invariant clause). The round-3 recording becomes the before-state against which round-4 is measured.
- **2026-04-21 — Round 8 pivot amendment** landed by PM on Director audit (held gate at `8a21830`; audit at `~/.claude/state/dev-collab/audits/autopilot-shake-redesign-2026-04-21.md`). Context: rounds 6 and 7 silently replaced the Bible §8H asymmetric log-impulse envelope with a continuous sinusoidal bob; ACs #2 and #4 went to zero in code while staying live in the brief; the round-6 Status block reframed the regression as the design. Pivot picks **Path A — restore canon**, not Path B — there is no basis for a canon-change escalation in Max's round-5 feedback, and Bible §8H (lines 1307–1309) is active canon Max co-authored the same day. Scope: revert the continuous-bob code (`Math.sin(_timeAccum × BOB_FREQUENCY × 2π)`, `Math.abs(dSpeed)` sign-discard); restore round-5-era asymmetric log-impulse-train precompute (`ACCEL_AMPS = [0.30, 1.00, 0.70, 0.35, 0.10]`, `DECEL_AMPS = [1.00, 0.55, 0.30, 0.17]`, log-spaced timing); preserve round-6's correct continuous `d|v|/dt` signal source as the event-onset trigger; preserve round-7's `cam2tgt` scale insight but freeze it at impulse onset per round-4 drift-risk 2. ACs #2 and #4 reaffirmed as-is. No Bible or SYSTEM_CONTRACTS edits needed — code drifted, canon didn't. Gate stays held pending Director re-audit of this amendment.
- **2026-04-21 — Round 9 pivot amendment** landed by PM on Director direction (audit at `~/.claude/state/dev-collab/audits/autopilot-shake-redesign-2026-04-21.md` §"Round-9 PM direction"). Context: round-8 closed at `VERIFIED_PENDING_MAX 46ca75e`; Max watched the recording and rejected the continuous-`d|v|/dt`-onset firing model because it fired shake during orbit phases where orbit pitch/breathe/settle produces legitimate but non-dramatic speed changes. Verbatim ruling: *"this shaking/rumbling should only happen when accelerating or decellerating dramatically ... only when blasting off from one system object to another, if far enough apart."* Max answered three Director-surfaced questions: distance gate is physics-grounded ("sufficiently close to the speed of light and accelerate to that speed sufficiently fast"), no additional qualifier needed beyond phase-boundary + distance, warp exit has NO accel (portal handed ship cruise speed already) but DOES have decel at arrival into orbit. Director operationalized: reuse existing `NavigationSubsystem._isShortTrip` (line 357) as the distance gate; accel fires on `TRAVELING` enter with `!_isShortTrip && !warpExit`; decel fires on `travelComplete` one-shot with `!_isShortTrip` (warp-exit included). Scope: delete continuous-signal onset path + `ONSET_THRESHOLD` + `ONSET_REFRACTORY` + `subThreshold` timer; keep envelope arrays, timing constants, Gaussian bumps, atomic onset freeze, `cam2tgt`-freeze invariant, debug hooks all verbatim. AC #3 rewritten from signal-driven to event-driven; ACs #1, #2, #4 unchanged (shape is correct; trigger changed); ACs #5, #6, #7 added for orbit-silence, short-hop-silence, and warp-exit-asymmetry invariants. Bible §8H stays as written — lines 1303 and 1309 already canonize the round-9 model; the continuous-signal reading was the drift. Gate stays held pending Director re-audit of this amendment.

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

## Round-3 amendment (2026-04-21)

**Context.** Max watched the round-2 recording (commit `8a9161f`, drop path `screenshots/max-recordings/autopilot-shake-redesign-2026-04-21.webm`) and flagged two experiential issues + one tooling gap. His verbatim feedback:

> *"This has introduced some weird wobbly stuff happening when we get to the planet. Also, the deceleration wobble is happening way earlier than I would expect. I think we need to rethink how our sci-fi deceleration and acceleration is happening. In other words, unlike a realistic deceleration, which would need to happen halfway to the thing you're getting to, our sci-fi gravity drive deceleration can happen pretty much right when we're arriving at the thing. So, take that into account. Also, if you don't currently with the existing telemetry system have the ability to see how the screen shake is happening without looking at it visually, we need to implement some way of you being able to see the coordinates of what's going on with the camera, like what angle the camera is at and what not so that you can see what's happening. Because once we get into orbit, I'm seeing some weird wobbling happening now that I would anticipate you should be able to catch, even without looking at it visually if such a system is in there."*

Two ACs added (#8 arrival-timing trigger, #9 telemetry recorder). The "weird wobbly stuff when we get to the planet" is **not** scoped as a separate AC in this round — the mechanism is not yet known; AC #9's telemetry is the instrument that will classify it (residual shake envelope extension, a separate shake source, or a non-shake camera artifact). If post-fix telemetry shows residual orbit-phase shake, that is a round-4 follow-up bug, not a patch to slipstream into this round.

8. **Decel impulse fires at arrival, not at the travel→approach boundary** (per Max's verbatim: *"the deceleration wobble is happening way earlier than I would expect ... our sci-fi gravity drive deceleration can happen pretty much right when we're arriving at the thing"*). The current round-2 trigger fires decel on the subsystem's `travelComplete` event, which corresponds to the `traveling → approaching` phase transition — the start of the ~4.5s approach animation, not its end. Per the gravity-drive lore (Bible §8H, pending the arrival-compensation clause extension flagged under §Round-3 director actions), a sci-fi gravity drive can brake sharply at the destination rather than integrating over half the transit like realistic physics requires. STATION arrival is a hard settle, not a gradual slowdown; the shake belongs at the moment the ship settles into orbit, not at the moment the ship begins its close-in. **Detection mechanism (choreographer-side, not subsystem-side):** the choreographer tracks the prior-frame `motionFrame.phase` value; on the frame where prior-frame phase is `'approaching'` and current-frame phase is `'orbiting'`, fire the decel impulse. No new one-shot field on the subsystem (`approachComplete` / `arrivedAtStation` were considered and rejected — choreographer-side phase-transition detection keeps subsystem edits at zero). AC: "Verified in a new recording: the decel shake happens at the moment the ship settles into orbit around the target (end of approach), not during the approach's close-in animation." Diagnostic backup via AC #9: telemetry `shakeMag` time-series shows the decel spike coinciding with the `navPhase` transition from `'approaching'` to `'orbiting'`, not from `'traveling'` to `'approaching'`.

9. **Telemetry recorder for programmatic state inspection** (per Max's verbatim: *"we need to implement some way of you being able to see the coordinates of what's going on with the camera, like what angle the camera is at and what not so that you can see what's happening ... I would anticipate you should be able to catch, even without looking at it visually if such a system is in there"*). Adds `window._autopilot.telemetry` with `.start()` and `.stop()` methods. `.start()` begins per-frame sampling into an in-memory buffer; `.stop()` halts sampling and returns the accumulated array. Location: `src/main.js` as a main-local helper (~20 lines), not inside `ShipChoreographer` — this is diagnostic scaffolding per Principle 2, not a subsystem capability. **Sample shape per frame:** `{ t, camPos: [x,y,z], camFwd: [x,y,z], shipPhase, navPhase, shakeOffset: [x,y,z], shakeMag, abruptness }` where:
   - `t` — timestamp (ms, `performance.now()` or equivalent)
   - `camPos` — camera world position vec3
   - `camFwd` — camera forward unit vector vec3 (or equivalent euler; vec3 preferred for programmatic diff)
   - `shipPhase` — ship-axis phase string (ENTRY / CRUISE / APPROACH / STATION per WS 2's ShipAxisMotion state machine)
   - `navPhase` — navigation-subsystem phase string (`'traveling'` / `'approaching'` / `'orbiting'` per `MotionFrame.phase`)
   - `shakeOffset` — the full `shipChoreographer.shakeOffset` vec3 that frame
   - `shakeMag` — `shakeOffset.length()` scalar (redundant but cheap; makes time-series analysis one-liner)
   - `abruptness` — the scalar [0,1] `_abruptness` signal inside `ShipChoreographer` that frame
   
   AC: "Working-Claude can invoke `window._autopilot.telemetry.start()`, run autopilot for N seconds (e.g., a full Sol tour), invoke `.stop()`, and receive an array of per-frame samples suitable for programmatic analysis. Verified by running a test capture and confirming: (a) array length ≈ N × 60 (frames per second), (b) first/last samples contain non-null `camPos` + `camFwd` + phase fields, (c) after AC #8 fix lands, `shakeOffset` samples during sustained orbit are `[0,0,0]`."

### Round-3 director actions (flagged, NOT done in this brief)

- **`docs/GAME_BIBLE.md` §8H Gravity Drive — arrival-compensation clause extension.** Add to the existing lore: *gravity-drive deceleration is **arrival-compensation** — the drive can brake sharply at the destination rather than integrating over half the transit like realistic physics requires. This is why STATION arrival feels like a hard settle, not a gradual slowdown.* Place alongside or immediately after the ether-metaphor paragraph landed in round-2 (commit `cde2d7f`). Director-owned edit.
- **`docs/SYSTEM_CONTRACTS.md` §10.8 Gravity-drive shake invariant — trigger-phase refinement.** Refine the decel-trigger bullet: *decel shake trigger is the `approaching → orbiting` phase transition (arrival moment), **not** the `traveling → approaching` boundary (halfway / coast-end). This is the implementation of Bible §8H's arrival-compensation clause — the drive's brake fires when the ship settles into orbit, not when it begins its approach animation.* Director-owned edit.
- Both edits must land on master before the combined Shipped flip (this workstream + WS 2) — same gate structure as the round-2 Bible/contract edits (commit `cde2d7f`).

### Round-3 out-of-scope

- **Orbit-phase wobble-squashing code.** Max's "weird wobbly stuff when we get to the planet" is explicitly NOT scoped as an AC in this round. The orbit wobble has no confirmed mechanism yet — the post-recording impulse-train duration math (decel envelope ~1.1s from onset vs. ~4.5s approach phase) rules out residual-tail-into-orbit as the mechanism. AC #9's telemetry captures the orbit-window `shakeOffset` samples and will classify the wobble in a follow-up round. Working-Claude runs a telemetry capture (AC #9) at Sol over a full tour after the AC #8 fix lands and analyzes the `shakeMag` time-series during the sustained-orbit window. If `shakeOffset` samples during orbit are `[0,0,0]` (AC #9's verification point c), the orbit wobble was indeed a symptom of #8 and is now gone. If `shakeMag` is non-zero during sustained orbit, that is a **round-4 follow-up bug** — a new workstream or amendment, not a patch slipstreamed into this round. Do NOT preemptively scope orbit-wobble-squashing code into this round.
- **Subsystem phase-transition one-shot fields.** An `approachComplete` or `arrivedAtStation` one-shot field on `NavigationSubsystem` / `MotionFrame` was considered and rejected. Choreographer-side prior-frame-phase tracking is sufficient for AC #8's detection mechanism and keeps subsystem edits at zero for this amendment. If a future workstream finds a broader need for phase-transition events (e.g., audio hookup on arrival), that's a subsystem-surface question for that workstream to scope against §10.8, not a pre-emptive add here.
- **Accel trigger changes.** Max did not flag accel timing. The existing `motionStarted && phase === 'traveling'` onset continues to fire at the start of CRUISE, which IS "begin accelerating." Leave unchanged.

## Round-4 amendment (2026-04-21)

**Context.** Max watched the round-3 recording (commit `64a7725`, drop path `screenshots/max-recordings/autopilot-shake-redesign-2026-04-21.webm`, 34s Sol capture). Verbatim feedback:

> *"I'm seeing the camera go absolutely bonkers. Like the planets are like jiggling around all over the place. The view is looking up and down randomly. It looks awful."*

**Director-audited root cause (PM accepts).** Shake amplitude `SHAKE_MAX_AMPLITUDE = 0.6` in `src/auto/ShipChoreographer.js:86` is expressed in **scene-unit absolutes**. Sol orbit distances range from `0.06` (innermost moon) to `40` (star) — a **666× spread**. A 0.6-unit world-Y shake at d=0.06 produces approximately **±84° of view-space vertical swing per impulse**; the decel train's alternating bump sign (envelope `[1.00, 0.55, 0.30, 0.17]` with sign-alternation in the bump-sum) then lurches the camera up/down/up/down across ~1s at every moon-arrival. Round-3 telemetry did not catch this because `shakeMag` was sampled in scene-unit absolutes only — the per-body ratios (`shakeMag / orbitDistance`, `shakeMag / bodyRadius`, `shakeMag / cameraToTargetDistance`) that make the number meaningful were not sampled. Sampling scene-unit magnitude alone is the measurement mistake that hid the bug.

**PM's AC #10 mechanism pick (a): scale by current-target `orbitDistance`.** Rationale (one sentence per the round-4 brief): `orbitDistance` is already live on the tour leg (`stop.orbitDistance` at arrival, `toOrbitDistance` mid-leg) so no new geometry lookup is needed, it tracks framing across body classes (moons have small orbitDistance because they're framed close, stars have large orbitDistance because they're framed far — exactly the scale the shake should ride on), and it maps 1:1 onto how the shake reads perceptually (a fixed fraction of orbitDistance ≈ a fixed fraction of the visible frame the body occupies). Option (b) bodyRadius is close but conflates body-size with framing (a big dim star framed from far away should shake less, not more); option (c) live camera-to-target distance varies during approach and would retune mid-event (fails the "frozen at onset" rule — see round-4 drift risk 2 below).

10. **Amplitude scale-coupling — shake-offset magnitude is a bounded fraction of the current-target `orbitDistance`, NOT scene-unit absolute.** (Per Max's round-4 verbatim: *"planets are jiggling around all over the place ... the view is looking up and down randomly"* — the scale-coupling failure read at moon-arrival.) The peak impulse-train amplitude for an event is computed as `peakAmp = orbitDistanceAtOnset * SHAKE_AMPLITUDE_FRACTION` for some bounded fraction (suggested V1 range: `[0.05, 0.15]` — tunable but must stay bounded; Max + Director iterate during recording review). This replaces (or is composed with, working-Claude decides — see round-4 In scope) the current scene-unit `SHAKE_MAX_AMPLITUDE = 0.6`. The scale factor (`orbitDistanceAtOnset`) is **frozen at impulse onset** alongside the shake axis — a tour-leg transition mid-ringout does not re-scale an in-flight impulse train (per drift risk 2 below). Scaling applies to the **whole envelope sequence** (`ACCEL_AMPS` and `DECEL_AMPS` arrays multiply through the frozen peak), not just to the `SHAKE_MAX_AMPLITUDE` constant — otherwise the log-decay ratios between impulses drift across body classes (per drift risk 1 below). **Verification (ratio-based, load-bearing):** on a multi-body Sol tour, the ratio `shakeMag / orbitDistanceAtOnset` at each per-event peak stays bounded within `[0.05, 0.15]` (or whatever fraction range working-Claude picks and Max approves during recording review) across star/planet/moon arrivals. Scene-unit magnitude alone is **not** an acceptable verification. Diagnostic backup via AC #11 telemetry: time-series plot of `shakeMag / currentTargetOrbitDistance` across the full tour shows peaks bounded in a narrow range, not a 666× spread that tracks the underlying `orbitDistance` variation.

11. **Multi-body stress-test telemetry — per-sample target-scale fields + pathological-case debug entry point.** (Per round-3 AC #9 telemetry scaffolding, extended for round-4 scale-coupling verification.) Extends the existing `window._autopilot.telemetry` sample shape (ACs #9) with four new scalar/string fields. This extends the sample shape, not replace it — round-3 fields (`t`, `camPos`, `camFwd`, `shipPhase`, `navPhase`, `shakeOffset`, `shakeMag`, `abruptness`) stay as-is. Added fields:
   - `currentTargetOrbitDistance` — scalar. The active tour leg's `toOrbitDistance` during traveling/approaching; the arrived-at stop's `orbitDistance` during orbiting. `null` if no active tour.
   - `currentTargetBodyRadius` — scalar. Radius of the body being approached / orbited. `null` if unknown.
   - `cameraToTargetDistance` — scalar. Live `camera.position.distanceTo(bodyRef.position)` where `bodyRef` is the current-target Object3D. `null` if no active tour.
   - `currentTargetType` — string. `'star'` | `'planet'` | `'moon'` | `'deepsky-poi'`. Classifies the body class so post-run analysis can confirm scale-coupling across all classes.
   
   **Stress-test protocol:** Sol, autopilot engaged, a full queue executed (star + all planets + at least 2 moons — specifically require moons because they are the pathological case). Telemetry captured across the full tour (`.start()` before engage, `.stop()` after final STATION). Post-run verification computes `shakeMag / currentTargetOrbitDistance` at each per-event peak and confirms the ratio is bounded across ALL body classes (AC #10 passes iff this ratio is uniformly bounded).
   
   **Pathological-case sub-test — debug entry point:** Adds `window._autopilot.debugArrivalAt(bodyType)` where `bodyType` in `['star', 'planet', 'moon']`. Invoking this forces a decel-impulse event using the scale factor of the specified body class (e.g., `debugArrivalAt('moon')` forces an event at `orbitDistance = <nearest moon's orbitDistance>`) so the worst case can be reproduced on-demand without waiting for the natural tour cadence. Implementation-wise the hook finds the nearest body of the specified type in the active system, grabs its `orbitDistance`, and calls the existing `debugDecelImpulse()` path with that scale factor as the onset `orbitDistanceAtOnset`. Entry point is diagnostic scaffolding (Principle 2) — belongs alongside the existing debug hooks, removed when the workstream closes unless Director retains it for future recording verification.
   
   AC verified by: (a) running a full Sol tour with telemetry on, confirming the new fields are non-null for the expected duration of each leg; (b) invoking `debugArrivalAt('moon')` and confirming the forced event's `shakeMag / orbitDistanceAtOnset` ratio is identical to a natural moon-arrival event (within floating-point); (c) `shakeMag / currentTargetOrbitDistance` ratio time-series stays bounded across the full tour per AC #10.

12. **Motion evidence at a moon — round-4 recording includes at least one moon arrival.** (Per the original AC #7 recording gate, round-4-specific.) The round-3 recording arrived at a planet (body class `planet`), which does not evaluate the moon-class pathological case; the "bonkers" behavior is moon-specific at worst. Round-4 recording MUST include a moon arrival visible on-camera. **Capture specification:**
   - Sol, full autopilot tour engaged (not Sol-debug-single-body — the full tour cadence exercises star + planets + moons in sequence).
   - Telemetry (`window._autopilot.telemetry.start()`) engaged throughout.
   - Recording window covers at minimum one moon arrival visible (10–15s window around the moon-arrival STATION settle).
   - Recording length: long enough to capture at least one moon arrival plus the prior approach — if the full tour is 30–60s, record the full tour; if the tour is longer, an AccelImpulse + DecelImpulse + one moon-arrival subset is acceptable.
   - Drop path: `screenshots/max-recordings/autopilot-shake-redesign-round4-2026-04-21.webm` (distinct from round-3's drop path — round-3 recording is preserved as the before-state).
   
   Post-capture verification: (a) Max's eyeball review on the recording — the camera does NOT go "bonkers" at the moon arrival; shake at the moon reads as a bounded bob proportional to the body's framing, not a view-flipping lurch; (b) telemetry post-run analysis per AC #11 confirms `shakeMag / currentTargetOrbitDistance` ratio bounded across the full tour including the moon leg. Both verifications required — ACs #10 and #12 are twin verifications (quantitative ratio + qualitative Max-evaluated motion) and both must pass for Shipped flip.

### Round-4 drift risks

Two added on top of the round-1/round-3 risks. These are the specific ways working-Claude could produce a scale-coupling fix that still fails.

- **Risk: Fix applied to `SHAKE_MAX_AMPLITUDE` constant only, not to the envelope arrays.** The tempting minimal edit is `SHAKE_MAX_AMPLITUDE = 0.6 * orbitDistance`, leaving `ACCEL_AMPS` and `DECEL_AMPS` unchanged. But the envelope arrays encode log-decay ratios (`[1.00, 0.55, 0.30, 0.17]` — δ≈0.55 between successive impulses), and if only the peak scales but the subsequent-impulse amplitudes are not multiplied through, the ratios between impulses drift across body classes (moon impulse 2 relative to its peak is no longer the same fraction as star impulse 2 relative to its peak). The whole train must scale together — the peak AND every subsequent impulse amplitude multiply by the same frozen `orbitDistanceAtOnset * fraction` factor.
  **Why it happens:** editing a single constant is less code than a scale-factor-in-the-precompute refactor.
  **Guard:** AC #10 explicitly specifies *"Scaling applies to the whole envelope sequence (`ACCEL_AMPS` and `DECEL_AMPS` arrays multiply through the frozen peak), not just to the `SHAKE_MAX_AMPLITUDE` constant."* Verification path via AC #11 telemetry: the ratio `shakeAmps[n] / shakeAmps[0]` at a moon-arrival event should equal the same ratio at a star-arrival event within floating-point. If it does not, the fix was applied at the wrong level. Director audit flag.

- **Risk: Scale factor computed at a different moment than axis-freeze — re-scaling mid-ringout.** The tempting minimal edit is computing `scaleFactor = currentTargetOrbitDistance * fraction` every frame inside the update loop. But a tour-leg transition mid-ringout (e.g., the last bump of a decel impulse still playing as the next leg's `beginMotion` fires) would change `currentTargetOrbitDistance` mid-event, retuning the scale factor DURING the impulse train. Pebble-skipping physics: each impulse is **one event**, not a continuously-retuned envelope. The scale factor must be frozen at onset alongside the shake axis, onset time, and sign (per the round-1 pattern in `ShipChoreographer._startImpulseTrain` or equivalent).
  **Why it happens:** the `currentTargetOrbitDistance` field is already being sampled per-frame for AC #11 telemetry; reading it into the shake math feels natural and is one less state variable.
  **Guard:** AC #10 explicitly specifies *"The scale factor (`orbitDistanceAtOnset`) is frozen at impulse onset alongside the shake axis — a tour-leg transition mid-ringout does not re-scale an in-flight impulse train."* Verification: on a back-to-back tour leg where leg N's decel ringout overlaps leg N+1's start, telemetry shows `shakeMag / (stored onset-scale)` remains flat across the overlap; if it jumps mid-ringout, scale was not frozen at onset. Director audit flag.

### Round-4 director actions (flagged, NOT done in this brief; Director lands after amendment closes)

- **`docs/SYSTEM_CONTRACTS.md` §10.8 Gravity-drive shake invariant — scale-coupling clause.** Add a new invariant bullet: *"Shake magnitude is bounded relative to the body being framed, not expressed in scene-unit absolutes. Scale factor (orbitDistance / bodyRadius / angular-framing — whichever the workstream implementing the shake picks) is frozen at impulse onset same as the shake axis. Scaling applies to the whole envelope sequence, not the peak alone — log-decay ratios between impulses must be preserved across body classes."* Places alongside the round-2 ether-metaphor and round-3 arrival-compensation invariants. This becomes a permanent invariant — future features (audio coupling, gravity-density tuning, per-class body tuning) land on top of a scale-coupled foundation, not on scene-unit absolutes. Director-owned edit. Must land on master before the combined Shipped flip (this workstream + WS 2).

### Round-4 in scope (additive to round-1/round-3 §In scope)

- **Rework `src/auto/ShipChoreographer.js` impulse-train precompute to scale-couple peak amplitude.** At impulse-train onset (the point where `_shakePrimaryAxis`, `_shakeOnsetTime`, sign are frozen), also freeze `_shakeOnsetScaleFactor = <currentTargetOrbitDistance> * SHAKE_AMPLITUDE_FRACTION`. Multiply this scale factor into every entry of `_shakeAmps` during the precompute step (so downstream per-frame `envelopeSample` reads pre-scaled amplitudes and no per-frame scale lookup is needed). `SHAKE_MAX_AMPLITUDE` as a bare scene-unit constant is either removed or becomes a cap/floor (working-Claude decides — a reasonable V1 is `SHAKE_MAX_AMPLITUDE` retained as a ceiling so a pathological-large-orbitDistance body doesn't produce a view-breaking bump, e.g., `peakAmp = min(orbitDistance * fraction, SHAKE_MAX_AMPLITUDE)` with `SHAKE_MAX_AMPLITUDE = 6.0` as a soft ceiling covering everything up to the star; Director iterates with Max during recording review).
- **`SHAKE_AMPLITUDE_FRACTION` tunable constant at the top of `ShipChoreographer.js`.** Suggested V1 value: `0.10` (midpoint of the `[0.05, 0.15]` range). Max tunes during recording review. Document the tunable alongside the existing `SHAKE_MAX_AMPLITUDE`, `SECONDARY_AXIS_RATIO`, envelope arrays block at L60–94.
- **Extend `window._autopilot.telemetry` sample shape with the four round-4 fields.** In `src/main.js` (the existing telemetry helper location per round-3 AC #9). Fields read from: `currentTargetOrbitDistance` from `nav.currentLeg.toOrbitDistance` or `nav.currentStop.orbitDistance` depending on phase; `currentTargetBodyRadius` from the target body's registered radius (OOI registry if available, else body `Object3D.userData.radius` or equivalent — working-Claude picks the most reliable source and cites it in the commit message); `cameraToTargetDistance` from `camera.position.distanceTo(targetBody.position)` — one Vector3 distance per frame, cheap; `currentTargetType` from the target's registered body type.
- **Add `window._autopilot.debugArrivalAt(bodyType)` pathological-case hook.** In `src/main.js` alongside the existing debug hooks. Finds the nearest body of the specified type in the active system, grabs its `orbitDistance`, forces a decel-impulse event at that scale factor via the existing `debugDecelImpulse()` path. Diagnostic scaffolding (Principle 2) — retained or removed at Director's call when the workstream closes.
- **One commit** for the round-4 scale-coupling + telemetry extension. Suggested message: `fix(autopilot): scale-couple shake amplitude to orbitDistance; extend telemetry for ratio-verification`. Cites ACs #10, #11. The telemetry-field additions are small enough they belong in the same commit as the scale-coupling fix (AC #11 is the measurement device for AC #10; splitting leaves AC #10 un-verifiable in the first commit).
- **One canvas recording per AC #12.** Sol, full tour engaged, moon arrival visible. Drop at `screenshots/max-recordings/autopilot-shake-redesign-round4-2026-04-21.webm`. Via `~/.claude/helpers/canvas-recorder.js` + `~/.local/bin/fetch-canvas-recording.sh` per existing capture path.
- **Update this brief's Status line** from `Scoped round-4 2026-04-21, blocking combined Shipped flip` → `VERIFIED_PENDING_MAX <sha>` (when round-4 commit lands + round-4 recording is on disk) → `Shipped <sha> — verified against screenshots/max-recordings/autopilot-shake-redesign-round4-2026-04-21.webm` (after Max's verdict + Director's §10.8 scale-coupling clause lands on master).

### Round-4 out of scope

- **Amplitude-debug-toggle (Max-eyeball live-tune mode).** A UI hook letting Max scrub `SHAKE_AMPLITUDE_FRACTION` in the dev console during playback. Nice to have; defer unless cheap. The telemetry stress-test (AC #11) is the primary verification — Max's recording-review verdict on AC #12 is the qualitative gate.
- **Separate workstream split.** Round-4 is same-concern (shake authoring), same-file (`ShipChoreographer.js`), same recording-loop as rounds 1–3. Splitting to a new workstream adds overhead without adding clarity.
- **Bible §8H extension.** The round-2 ether metaphor covers scale coupling implicitly — a denser ether near a small body and a sparser ether near a large body is the same metaphor at different radii. No new Bible lore clause needed this round. If a future feature exposes an authoring knob for per-body ether density (e.g., a moon "feels rockier" than a gas giant because its ether is denser), that's a V-later Bible add.
- **Per-class body tuning (moon-specific vs planet-specific vs star-specific amplitude fractions).** Tempting because the bonkers-at-moon observation suggests moons need special treatment. Rejected: scale-coupling via `orbitDistance` already handles body-class variation by construction (moons have small orbitDistance → small peak amp; stars have large orbitDistance → large peak amp, bounded by ceiling). Adding a per-class multiplier on top would be a patch over a foundation that should just work — Principle 6 (First Principles Over Patches) applies. If post-round-4 recording review shows moons still read wrong with scale-coupling, that's a round-5 signal the mechanism pick (`orbitDistance`) was wrong, not a signal to add per-class tweaks.
- **Round-3 orbit-wobble re-evaluation.** Round-3 §Round-3 out-of-scope flagged orbit-phase wobble as a post-telemetry classification task. With the scale-coupling fix in round-4, the orbit wobble may disappear on its own (if it was always moon-scale bonkers rather than a distinct wobble source). Round-4 telemetry capture will classify it definitively via sustained-orbit `shakeMag` samples. If wobble persists after scale-coupling with `shakeMag > 0` during sustained orbit, that is a round-5 bug, not a round-4 patch.

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

## Round-9 amendment (2026-04-21)

**Context.** Max watched the round-8 recording (commit `46ca75e`, drop path `screenshots/max-recordings/autopilot-shake-redesign-round8-2026-04-21.webm`) and rejected the continuous-`d|v|/dt`-onset firing model. Round-8's envelope math was correct — the telemetry probe confirmed 3–5 discrete peaks with log-decay ratios per AC #2 and visible accel/decel asymmetry per AC #4. What failed was the trigger surface: a threshold-crossing detector on smoothed `|d|v|/dt|` legitimately fires on orbit-phase pitch modulation, breathing, and arrival-distance settle — all real speed changes, none of them dramatic. Max's feedback makes the trigger-class decision unambiguous: the shake is a narrative event (*blasting off, arriving at a distant body*), not a signal-derived effect.

**Max's verbatim ruling:**

> *"what matters is that this shaking/rumbling should only happen when accelerating or decellerating dramatically. Only then. This will not happen in orbit, only when blasting off from one system object to another, if far enough apart. Let me know if you have questions about this."*

**Max's Q&A follow-up** (three questions Director surfaced in the initial round-9 direction pass; Max answered each):

- **Q1 (distance metric).** *"If we have to travel sufficiently close to the speed of light and accelerate to that speed sufficiently fast (or vice-versa), then there's turbulence."* Physics framing. Long legs → near-c → sharp endpoints → shake. Short hops → ship never reaches that regime → no shake. Operationalization delegated.
- **Q2 (additional qualifier beyond phase-boundary + distance).** Q1 answers Q2. No second qualifier.
- **Q3 (warp exit).** *"Remain at constant speed when exiting portal, until we slow down to get into the star's orbit."* No accel at ENTRY start (portal pre-loaded cruise speed). Decel at arrival into first body's orbit fires same as any other arrival.

**Director operationalization (delegated by Max, owned by Director, captured in the audit's §Round-9 PM direction; PM accepts verbatim).**

- **"Sufficiently long leg" = `!_isShortTrip`.** `NavigationSubsystem._isShortTrip = dist < Math.max(_currentDist * 5, 30)` at line 357 is already the canonical short/long discriminator the subsystem computes per-leg. Reusing it costs zero code surface and keeps the scoping decision inside the subsystem that owns the leg model. No new threshold constant. Distance-below-30-scene-units → "too close for turbulence"; distance-below-5×-current-orbit-distance → "we're bouncing around the same body, not blasting off to a new one."
- **Accel event fire point.** `NavigationSubsystem.phase` transitions into `TRAVELING` on a leg where `!_isShortTrip && warpExit === false`. Detectable choreographer-side via `motionFrame.motionStarted && motionFrame.phase === 'traveling'` (one-shot raised in NavigationSubsystem.js line 31; see also lines 199, 238–239).
- **Decel event fire point.** `motionFrame.travelComplete` one-shot raises on the frame travel ends (NavigationSubsystem.js line 32, raised at line 834 inside `_updateTravel`). Gate on `!_isShortTrip`. Fires for ordinary arrivals AND warp-exit arrivals — identical path; warp-exit distinction lives only on the accel side.

### Round-9 model — trigger is phase-boundary, shape is unchanged

**1. Structural model.** Phase-boundary-triggered events, not signal-triggered. Gated on `!_isShortTrip`. Asymmetric accel (crescendo-then-fade) / decel (impact-then-decay) envelope shapes from round-8 preserved verbatim. Max's physics framing is honored structurally: long legs are exactly the legs where the ship would reach near-c, and the phase boundaries (`TRAVELING` enter, `travelComplete`) are exactly the accel/decel moments.

**2. Per-phase firing rules (authoritative — repeated from Status block for AC-author reference):**

| Phase transition | Leg condition | Event fired |
|---|---|---|
| → `TRAVELING` (ordinary depart from orbit) | `!_isShortTrip && !warpExit` | ACCEL envelope |
| → `TRAVELING` (warp-exit coast) | `!_isShortTrip && warpExit === true` | **No event.** Ship is already at cruise speed; portal did the acceleration. |
| `travelComplete` (arrival into orbit/approach) | `!_isShortTrip` (any leg type, warp-exit or ordinary) | DECEL envelope |
| Any boundary | `_isShortTrip === true` | **No event.** Short hops silent. |
| `ORBITING` (any sub-state) | — | **No event, by construction.** Orbit phase is not an event surface at all; the trigger mechanism cannot fire here regardless of what continuous signals would report. |

**3. Trigger-surface wiring inside `src/auto/ShipChoreographer.js`.** `ShipChoreographer.update(dt, motionFrame)` already receives the MotionFrame (WS 2 integration). The round-9 trigger reads three fields:
- `motionFrame.motionStarted` (one-shot, line 31 of NavigationSubsystem.js) — fires on the first frame after `beginMotion`.
- `motionFrame.travelComplete` (one-shot, line 32) — fires on the frame `travelElapsed ≥ travelDuration` in `_updateTravel` (line 834).
- `motionFrame.phase` (string, line 30, values `'idle' | 'descending' | 'traveling' | 'approaching' | 'orbiting'` per line 30 doc and line 273 `_phaseName`).

`!_isShortTrip` and `warpExit` are NOT currently on MotionFrame. Two interface-shape options — working-Claude picks and cites in commit message:
- **(A) Extend MotionFrame** with `legIsShort: boolean` and `legIsWarpExit: boolean`. Lowest-complexity consumer API; touches `NavigationSubsystem.js` to add the fields to `getCurrentPlan()` (lines 259–270) and populate them inside `_beginTravel` (alongside existing `_isShortTrip` / `_warpArrival` assignments at lines 358, 396, 407, and 334). **PM note:** this IS a cross-file edit (touches NavigationSubsystem.js), which the round-1 brief §Drift-risk-4 and §Out-of-scope both named as scope-creep. Round-9 explicitly authorizes the field additions as the minimum viable interface — two one-line additions in `getCurrentPlan()`, two one-line assignments in `_beginTravel` — because option (B) is worse on ownership grounds.
- **(B) ShipChoreographer reaches into `NavigationSubsystem` directly** for `_isShortTrip` and `_warpArrival` private fields. Zero MotionFrame surface change but violates encapsulation — `_` prefix marks those as subsystem-private, and the choreographer becoming a second consumer of private state is exactly the "add-a-tack-on-query" path Principle 2 guards against.

PM's recommendation: **option (A)**. The MotionFrame extension is a two-field, doc-one-line change; `NavigationSubsystem` already has `_isShortTrip` and `_warpArrival` computed and ready to read; the fields are observables about the leg the frame belongs to, which is exactly what MotionFrame is for. Working-Claude can override to (B) only if it surfaces a specific reason in the commit message.

**4. What stays from round-8 (load-bearing, DO NOT re-derive):**

- `ACCEL_AMPS = [0.30, 1.00, 0.70, 0.35, 0.10]` — crescendo-then-fade, 5 bounces.
- `DECEL_AMPS = [1.00, 0.55, 0.30, 0.17]` — impact-then-decay, 4 bounces.
- `IMPULSE_INITIAL_GAP = 0.08`, `IMPULSE_SPACING_RATIO = 1.8` — log-spaced timing.
- Gaussian bump envelope shape per bounce.
- Atomic `_startImpulseTrain()` freezes `_shakeOnsetCam2Tgt` + event-type flag + `_shakeOnsetTime` + axis vector in one operation at event fire. No per-frame re-scale of `cam2tgt` — round-4 drift-risk 2 invariant is still canon.
- Single-axis shake, perpendicular to velocity (AC #1 unchanged).
- `debugAccelImpulse()` / `debugDecelImpulse()` distinct entry points; both ignore `_isShortTrip` and `warpExit` gates (debug fire is unconditional — this is diagnostic scaffolding, it fires on-demand).
- `_pendingDebugFire` mechanism that lets debug hooks enqueue an event for the next update tick.
- `SHAKE_VIEW_ANGLE_MAX = 0.05` (round-7's insight, carried through round-8) as the `viewAngleTarget` for per-impulse peak amplitude `peakAmp = viewAngleTarget × _shakeOnsetCam2Tgt`.

**5. What goes from round-8 (retire entirely):**

- `ONSET_THRESHOLD` constant — no more "is `|d|v|/dt|` above X" check. Events fire from phase transitions, not signal crossings.
- `ONSET_REFRACTORY` window — phase transitions are naturally one-shot per leg; refractory is meaningless.
- `subThreshold` timer — dead with the threshold.
- The signal-driven onset path in `ShipChoreographer.update()` that reads continuous `dSpeed`, smooths it, compares to threshold, calls `_startImpulseTrain` autonomously. Delete. `_startImpulseTrain` becomes callable only by (a) phase-transition listener, (b) `_pendingDebugFire` consumer.
- `_signedDSpeed` as envelope discriminator — replaced by event type (which branch called `_startImpulseTrain`). If kept at all, it's as logged telemetry, not as a trigger input. Recommend removal unless the round-8 telemetry probe still consumes it for post-run analysis.
- Continuous `dSpeed` smoothing math (`DSPEED_SMOOTHING = 0.15` low-pass filter, `_prevSpeed` tracking for `dSpeed = (currSpeed - _prevSpeed) / dt`) — if unused elsewhere, remove. Working-Claude checks; if it's only feeding the deleted onset detector, delete.

### Round-9 ACs

ACs #1, #2, and #4 from the original brief are **reaffirmed verbatim** — the response shape did not change, only the trigger did. AC #3 is **rewritten** from signal-driven to event-driven. ACs #8, #9, #10, #11, #12 from rounds 3 and 4 carry forward unchanged (telemetry scaffolding, scale-coupling, drift-risk guards). Three new ACs (#13 orbit-silence, #14 short-hop-silence, #15 warp-exit-asymmetry) are added as invariants the round-9 trigger must preserve by construction.

1. **[UNCHANGED] Single-axis shake — the shake offset is a scalar amplitude × one unit vector, not a 3D cloud.** (Original AC #1; reaffirmed verbatim.)
2. **[UNCHANGED] Logarithmic impulse-train envelope — the shake manifests as 3–5 discrete bounces with logarithmically-spaced timing AND logarithmically-decaying amplitude.** (Original AC #2; reaffirmed verbatim. Round-8 telemetry already demonstrated this passes for both envelopes.)
3. **[REWRITTEN] Trigger is phase-boundary event (leg-start `TRAVELING` enter for accel; `travelComplete` for decel), gated by `!_isShortTrip`. The continuous `d|v|/dt` signal is no longer a trigger surface — it may remain as telemetry but does not cause shake.** Verified: (a) a smooth autopilot tour in which every leg has `_isShortTrip === false` produces exactly one accel impulse on each non-warp-exit `TRAVELING` enter and exactly one decel impulse on each `travelComplete`; (b) no shake fires between those two boundaries (mid-CRUISE is silent); (c) no shake fires during any `_phase === ORBITING` or `_phase === APPROACHING` frame regardless of `|d|v|/dt|` magnitude; (d) the code path from MotionFrame to `_startImpulseTrain` has exactly two call sites (accel branch + decel branch), not a continuous-signal path.
4. **[UNCHANGED] Accel shake pattern and decel shake pattern are visibly, temporally asymmetric.** (Original AC #4; reaffirmed verbatim. Back-to-back `debugAccelImpulse()` / `debugDecelImpulse()` in the round-9 recording remains the eyeball-evaluable artifact.)
5–12. [UNCHANGED from rounds 1–4.] WS 2 invariants (AC #5), Director actions flagged (AC #6), motion evidence recording (AC #7), arrival-timing decel trigger (AC #8), telemetry recorder (AC #9), amplitude scale-coupling (AC #10), multi-body stress-test telemetry (AC #11), moon-arrival recording (AC #12) — all preserved. Round-9 trigger change is compatible with each: AC #8's "decel at arrival" IS the `travelComplete` fire point; AC #10's scale-coupling is orthogonal to trigger class; AC #12's moon recording becomes the long-leg dramatic-transit test by construction since the Sol tour includes at least one leg with `!_isShortTrip` into a moon.
13. **[NEW] Orbit-silence invariant.** Shake amplitude is zero for every frame where `motionFrame.phase === 'orbiting'`, regardless of `|d|v|/dt|` magnitude, orbit pitch oscillation, orbit breathing, or any other motion signal. Enforced by construction: orbit/station phases do not call `_startImpulseTrain`; the code path does not exist. Verified via telemetry probe per AC #9: sustained-orbit window of ≥4s produces `shakeOffset === (0,0,0)` on every sample. This is the invariant that failed round-8 and is load-bearing for round-9 acceptance.
14. **[NEW] Short-hop-silence invariant.** Shake does not fire on any leg where `_isShortTrip === true`. Enforced at the phase-transition listener: the `!_isShortTrip` predicate is evaluated before `_startImpulseTrain` is called. Verified via telemetry on a short-hop scenario (e.g., moon → neighboring moon around the same planet — `dist < Math.max(_currentDist * 5, 30)`): no accel on the `TRAVELING` enter, no decel on `travelComplete`, `shakeOffset === (0,0,0)` throughout.
15. **[NEW] Warp-exit asymmetry invariant.** A warp-exit leg (`warpExit === true`) fires NO accel envelope at `TRAVELING` enter — the ship coasts at cruise speed from the portal per Max's Q3 answer and Bible §8H line 1309's "arrival-is-the-event" canon. The decel envelope on `travelComplete` fires normally per AC #3's gating (distance-gated, not warp-flag-gated). Verified via a Sol warp-arrival scenario: `shakeOffset` is `(0,0,0)` across the ENTRY/TRAVELING frames (warp coast); the decel envelope fires at the `travelComplete` boundary as the ship brakes into the first body's orbit.

### Round-9 director actions (NOT done in this amendment; Director owns)

**No Bible edit required.** Per Director's read of §8H in the audit direction note: line 1303 already names "warp-exit velocity mismatch" and "a transition that exceeds the drive's smoothing capacity" as firing conditions — phase boundaries on long legs ARE those transitions. Line 1304 reads "Shake magnitude is a function of motion-abruptness (motion discontinuity), not an authored per-moment effect" — phase boundaries are motion discontinuities under the event model. Line 1307 canonizes the asymmetric accel-vs-decel lore (round-9 preserves both envelopes verbatim). Line 1309 *explicitly* canonizes decel-at-arrival: *"the friction-against-ether event is the arrival event itself, because that is where the drive exerts its compensation impulse."* This is the decel gate verbatim. Max's Q3 answer (decel at orbit entry, not portal exit) is already Bible canon. The continuous-signal mental model that led to rounds 6–8 was itself the reading that diverged from §8H; round-9 is the more faithful implementation.

**Optional §10.8 parenthetical (Director's call, not Director-required).** A single clarifying bullet in `docs/SYSTEM_CONTRACTS.md` §10.8 *Gravity-drive shake invariant* could pin the event-model explicitly — e.g., *"Shake fires on phase-boundary events (`TRAVELING` enter for accel, `travelComplete` for decel), gated on leg distance via `!_isShortTrip`. It does not fire on continuous `|d|v|/dt|` threshold crossings."* This would prevent a future reader from replaying the rounds 6–8 signal-chasing pattern. Director decides; PM does not recommend either way — there's an argument for keeping §10.8 implementation-agnostic (the shape is invariant; the trigger is one valid implementation of §8H's "motion discontinuity") and there's an argument for pinning the implementation so this specific drift class cannot recur. Not a gate condition for round-9 release.

### Round-9 in scope

- **Rework `src/auto/ShipChoreographer.js` `update()`** to delete the continuous-signal onset path (the branch that reads `dSpeed`, smooths, compares to `ONSET_THRESHOLD`, and calls `_startImpulseTrain` autonomously). Replace with two gated phase-transition listeners reading `motionFrame.motionStarted && motionFrame.phase === 'traveling'` (accel branch) and `motionFrame.travelComplete` (decel branch), each gated on `!motionFrame.legIsShort` (+ `!motionFrame.legIsWarpExit` on the accel side only).
- **Extend `src/auto/NavigationSubsystem.js` MotionFrame** with `legIsShort: boolean` and `legIsWarpExit: boolean`. Two field additions to `getCurrentPlan()` (lines 259–270) reading from existing `this._isShortTrip` and `this._warpArrival` state (already set in `_beginTravel` at lines 334, 358, 396, 407). Update the `@typedef {Object} MotionFrame` block (lines 26–35) to document both fields. This IS a cross-file edit; explicitly authorized by this amendment per §3 option (A).
- **Delete retired round-8 surface.** `ONSET_THRESHOLD`, `ONSET_REFRACTORY`, `subThreshold` timer variable, continuous `dSpeed` smoothing (`DSPEED_SMOOTHING`, `_prevSpeed`, `dSpeed = ...` derivation if unused elsewhere). If `_signedDSpeed` isn't referenced outside the deleted onset path, remove it too. Working-Claude cites what was deleted in the commit message for bisect reference.
- **Preserve from round-8 verbatim.** `ACCEL_AMPS`, `DECEL_AMPS`, `IMPULSE_INITIAL_GAP`, `IMPULSE_SPACING_RATIO`, `SHAKE_VIEW_ANGLE_MAX`, Gaussian bump shape, atomic `_startImpulseTrain()` with onset freeze (`_shakeOnsetCam2Tgt` + event-type flag + `_shakeOnsetTime` + axis), `debugAccelImpulse()` / `debugDecelImpulse()` entry points, `_pendingDebugFire` mechanism.
- **One commit.** Suggested message: `feat(autopilot): phase-boundary shake trigger gated on !_isShortTrip, warp-exit coast (round 9)`. Scope: the `ShipChoreographer.js` trigger rework + the two `NavigationSubsystem.js` MotionFrame field additions. Cites ACs #3 (rewritten), #13, #14, #15.
- **One canvas recording at `screenshots/max-recordings/autopilot-shake-redesign-round9-2026-04-21.webm`.** Sol, full tour engaged, at least one long-leg (e.g., star → outer planet) to fire accel + decel at phase boundaries, at least one short-hop (e.g., moon → neighboring moon) to demonstrate short-hop silence, at least one `debugAccelImpulse()` + `debugDecelImpulse()` pair to demonstrate the envelope asymmetry eyeball-evaluably. Capture via `~/.claude/helpers/canvas-recorder.js` + `~/.local/bin/fetch-canvas-recording.sh`. Contact sheet via `~/.local/bin/contact-sheet.sh` resized ≤1800px per axis (per `feedback_image-size-caps.md`).
- **Telemetry self-audit before closing.** Using `window._autopilot.telemetry.start()` / `.stop()` per AC #9 — run a Sol tour that includes at least one long-leg arrival, at least one short-hop, and a sustained orbit window. Verify programmatically: (a) `shakeOffset === (0,0,0)` across every `navPhase === 'orbiting'` frame (AC #13); (b) `shakeOffset === (0,0,0)` across legs where `legIsShort === true` (AC #14); (c) accel envelope fires exactly at the `motionStarted && !legIsWarpExit && !legIsShort` frame and not before or after (AC #3); (d) decel envelope fires exactly at the `travelComplete && !legIsShort` frame (AC #3, AC #8). This is working-Claude self-audit, not the Shipped artifact — Max evaluates the recording.
- **Update this brief's Status line** on commit from `HELD — ROUND 9 PIVOT ...` → `VERIFIED_PENDING_MAX <sha>` (when commit lands + recording on disk) → `Shipped <sha> — verified against screenshots/max-recordings/autopilot-shake-redesign-round9-2026-04-21.webm` (after Max's verdict).

### Round-9 out of scope

- **Bible §8H edit.** Per Director's read (above), §8H stays as written. Not re-opening this question. If a future rendering pass reveals a §8H gap the round-9 model exposes, that's a fresh Director-owned audit, not a slipstream into round-9.
- **SYSTEM_CONTRACTS §10.8 edit.** Optional per Director's call; not a gate condition. PM does not recommend either way. If Director picks "yes, pin the event-model," that's a Director-owned edit landing independently of round-9 commit.
- **Re-tuning envelope arrays or timing constants.** Round-8's `ACCEL_AMPS`, `DECEL_AMPS`, `IMPULSE_INITIAL_GAP`, `IMPULSE_SPACING_RATIO`, `SHAKE_VIEW_ANGLE_MAX` all passed round-8 telemetry. Round-9 preserves them verbatim. If the round-9 recording shows the envelope needs tuning, that's a round-10 amendment, not an in-flight tune.
- **Adding additional phase-boundary events.** E.g., firing a small tremor on `approaching → orbiting` (round-3's AC #8 style). Round-9 explicitly does NOT add this: Max's ruling was dramatic accel/decel between distant bodies, period. APPROACH → STATION is NOT a dramatic transition in Max's framing (the ship is already within the body's orbit frame, decel has already fired at `travelComplete`). Adding a secondary APPROACH-end tremor would re-introduce the "shake fires during orbit approach" pattern Max just retired.
- **Re-visiting `_isShortTrip` threshold.** The existing `dist < Math.max(_currentDist * 5, 30)` at line 357 is the distance gate. Max did not flag this threshold as wrong; Director operationalization reuses it verbatim. If post-round-9 recording shows the threshold is off (e.g., Sol's innermost planets qualify as short-hop and miss shake where Max expected it), that's a round-10 discussion about the threshold constant, not a round-9 scoping question.
- **Moving `_isShortTrip` / `_warpArrival` out of private state.** The round-9 MotionFrame extension exposes them as `legIsShort` / `legIsWarpExit` on the output frame; the subsystem-internal fields remain `_`-prefixed. No broader visibility refactor.
- **Separate module for shake.** Still V-later per round-1 drift-risk 4. Round-9 targets one trigger rework in one file (+ two-field MotionFrame extension). If the itch to refactor returns, file a future workstream — not this round.

### Round-9 drift risks

- **Risk: Trigger wired to the wrong phase enum value.** NavigationSubsystem's phase names (`'idle' | 'descending' | 'traveling' | 'approaching' | 'orbiting'`, line 30) do not map 1:1 onto the WS 2 ship-axis phase names (ENTRY / CRUISE / APPROACH / STATION). The ship-axis phase labels in prior rounds of this brief loosely correspond to navigation-phase names (e.g., "ENTRY" ≈ navigation's warp-exit TRAVELING coast, "CRUISE" ≈ post-coast TRAVELING, "APPROACH" ≈ APPROACHING, "STATION" ≈ ORBITING). Round-9 fires on navigation phases, not ship-axis phases — the accel trigger is `motionFrame.phase === 'traveling'` (the navigation phase), not a WS 2 ShipAxisMotion state.
  **Why it happens:** the round-1 brief's preserve-vs-change table (line 192) mentions "ENTRY / CRUISE / APPROACH / STATION per WS 2's ShipAxisMotion state machine" in the AC #5 context, inviting a reading where the trigger should match those phase names.
  **Guard:** the trigger reads `motionFrame.phase` (line 30 of NavigationSubsystem.js, values per `_phaseName()` at line 273). The choreographer does NOT read WS 2 ship-axis phase names for this trigger. If working-Claude's code references `ShipAxisMotion.State` or imports ENTRY/CRUISE/APPROACH/STATION constants for the trigger, that's the anti-pattern — escalate to PM.
- **Risk: Warp-exit accel slips through because `warpExit` is checked on the wrong leg.** `_warpArrival` is set inside `_beginTravel` (line 334) from the `warpExit` input to `beginMotion()`. The ordering is: `beginMotion` receives `warpExit=true`, `_beginTravel` sets `_warpArrival = true` and configures a 3s coast, `_updateTravel` runs until `travelElapsed >= travelDuration`, at which point `travelComplete` raises. If MotionFrame.legIsWarpExit is populated from `this._warpArrival` inside `getCurrentPlan()`, the field reads correctly on every frame of the warp-exit leg — including the `motionStarted` frame (where the accel trigger would otherwise fire). Good. But if `_warpArrival` is reset to `false` between `travelComplete` and the next leg's `beginMotion` (which it isn't today — `_warpArrival` is only reset via the next `_beginTravel` call), the invariant holds by construction.
  **Why it happens:** a future refactor could move `_warpArrival` reset into `stop()` or into the `travelComplete` handler, which would zero the field mid-frame on the arrival tick, making the decel-side check see `warpExit=false` when it should see `warpExit=true` — except decel's gate is `!_isShortTrip` only, no warp check, so this drift doesn't affect decel. It affects accel only, and accel has already fired on `motionStarted` before `_warpArrival` could be reset.
  **Guard:** the MotionFrame `legIsWarpExit` field populates from `this._warpArrival` inside `getCurrentPlan()` (read-only; does not mutate the field). The accel branch in ShipChoreographer reads `motionFrame.legIsWarpExit` on the `motionStarted` frame — exactly when `_warpArrival` is freshly set by `_beginTravel` and has not been reset. Director audit flag for the MotionFrame wiring.
- **Risk: Short-hop gate implemented as a magnitude check rather than `!_isShortTrip`.** Tempting minimal edit: compare `motionFrame.legDistance > 30` or similar, instead of reading `motionFrame.legIsShort`. But `_isShortTrip = dist < Math.max(_currentDist * 5, 30)` has TWO terms (relative to current orbit distance AND absolute floor); duplicating only the absolute-floor check would drift the gate away from the subsystem's canonical definition.
  **Why it happens:** `legIsShort` as a MotionFrame field is a new surface; a bare-`dist` field feels equivalent and the derivation feels obvious.
  **Guard:** MotionFrame exposes `legIsShort: boolean` directly — precomputed inside the subsystem from `_isShortTrip`. ShipChoreographer reads the boolean, does not re-derive. If working-Claude's code computes a short-trip condition from `motionFrame.legDistance` or any other raw distance value, that's the anti-pattern — the subsystem owns the definition of "short," the choreographer consumes it.
- **Risk: `travelComplete` one-shot missed because listener polls instead of reading the one-shot atomically.** The `travelComplete` one-shot raises for exactly one frame — the frame where travel ends and the next phase (`_beginOrbit` or `_beginApproach`) starts. ShipChoreographer's `update()` receives `motionFrame` once per frame; reading `motionFrame.travelComplete` synchronously within that update is correct. But if working-Claude wraps the trigger logic in a polling mechanism that samples MotionFrame at a different cadence (e.g., a `setInterval` or async handler), the one-shot may be missed.
  **Why it happens:** defensive coding — "let me check the one-shot is still true before firing, maybe via a debounce."
  **Guard:** the trigger listener runs inside `ShipChoreographer.update(dt, motionFrame)` synchronously; reads `motionFrame.travelComplete` once per call; calls `_startImpulseTrain(DECEL)` if true + `!motionFrame.legIsShort`. No polling, no debounce, no async wrapper. The same pattern applies to `motionStarted`. If working-Claude's code introduces a timer or schedules the trigger for a future frame, that's the anti-pattern — the one-shot is atomic to its frame.

### Gate release condition

Director re-audits this amendment (fourth audit on this workstream) and verifies against the audit's §Round-9 PM direction:
1. Phase-transition trigger surface is unambiguous (§Round-9 model #3).
2. `!_isShortTrip` gate is pinned by line reference into `NavigationSubsystem` (line 357 — amendment cites verbatim).
3. Warp-exit carve-out is explicit on the accel side (§Round-9 model #2 table row 2 + AC #15).
4. ACs #13, #14, #15 authored per audit spec (or equivalent phrasing Director accepts).
5. Round-4 drift-risk-2 guard (`cam2tgt` freeze at onset) remains preserved (§Round-9 model #4 bullet 5).
6. Round-8 envelope arrays + timing constants carry verbatim (§Round-9 model #4).
7. No Bible edit in this amendment; §8H reconciliation noted as "stays as written" with line citations (1303, 1304, 1307, 1309).

If the audit passes, gate releases scoped to the round-9 commit only. State updates to `{ "edits": 0, "last_audit_sha": "<pm-amendment-sha>" }` on release. Working-Claude does NOT edit code until Director audit lands.

Drafted by PM 2026-04-21 as the round-9 pivot amendment, following Max's ruling on the round-8 recording and Director's operationalization of his Q&A answers.

## Round-10 amendment (2026-04-21)

**Context.** Max watched the three round-9 recordings and rejected the result as *"awful, way off the mark."* Three concrete bugs + one felt-experience reframe (both verbatim blocks reproduced in §Status above). Director audited, classified the miss as a spec-class failure ("telemetry asserted the code did what the brief said; the brief did not assert what Max asked for"), and issued round-10 direction at `~/.claude/state/dev-collab/audits/autopilot-shake-redesign-2026-04-21.md` §"Round-9 REJECTED — retry." PM surfaced three questions to Max (envelope duration + register; envelope shape — tremor vs. discrete bumps; axis choice); Max answered all three:

> *"1. What I want is a 1-2 second shake that's subtle, not all over the place.*
> *2. High-frequency small-amplitude tremor, like aircraft turbulence.*
> *3. Honestly I'm not sure...let's try both from here but make it configurable so we can adjust"*

**What Max's answers settle.**

- **Duration + register (Q1).** 1–2 second event, subtle. Not violent, not view-flipping. Named as a tunable envelope duration in round-10 scope below (`TREMOR_ENVELOPE_DURATION = 1.5` seconds as V1 seed, bounded `[1.0, 2.0]`).
- **Shape (Q2).** Aircraft turbulence — high-frequency small-amplitude sustained tremor during the sharp-motion window, NOT discrete log-spaced bumps. This retires §8H's 4–5-bounce impulse-train rendering canon (addressed via Bible amendment — see §"Bible §8H amendment" below).
- **Axes (Q3).** Try pitch + yaw + roll, expose each as a configurable tunable so Max can dial individual axes up/down during review.

**Bible §8H amendment — committed in the same PM pass, separately.** Max's Q1+Q2 answers are definitive enough to canonize. Keeping §8H as 4–5-bounce discrete-impulse canon while round-10 implements a sustained tremor would force every future reader of §8H into rounds 6–8's reconciliation spiral (*"the Bible says bounces, the code says tremor, which is load-bearing?"*). PM's call: **amend §8H** to add a "Rendering shape — sustained tremor, not discrete bounces" paragraph after the existing ether paragraph. Load-bearing structure preserved verbatim (ether metaphor, compensation lag, asymmetric accel/decel as different physical events, arrival-is-the-event for decel); rendering shape refined so the asymmetry lives as an amplitude envelope over the tremor's duration rather than as bounce-count and bounce-amplitude arrays. Primary surface (camera rotation, not translation) also pinned in §8H, because the "planets bouncing" failure mode in round-9 was a rendering-surface error that §8H did not previously exclude. Bible commit lands separately from the brief commit (Director-owned artifact; PM bootstraps on Director's behalf per round-10 authorization, citing the audit's §"Round-9 REJECTED" direction as basis).

### Round-10 model

**1. Trigger model — continuous signal phase-gated to `traveling`.** Retire the phase-boundary one-shots from round-9 entirely (`motionStarted`-accel + `travelComplete`-decel). Replace with **continuous `|d|v|/dt|` signal, phase-gated**: onset detector runs ONLY while `motionFrame.phase === 'traveling' && !motionFrame.legIsShort`. Outside that phase-gate, the onset detector does not run — no sampling, no threshold comparison, no fire. This combines round-6's correct signal source (`|d|v|/dt|` derived from speed-delta, which is Bible §8H's "motion-abruptness" per line 1304) with round-9's correct phase-gate (orbit silence architectural, not by hope). Sharp-decel happens mid-Hermite (Hermite-ease `|d|v|/dt|` peaks at `t ∈ [0.3, 0.7]` of the travel segment, not at `t=1`); the tremor fires exactly there — *during* the sharp-motion event, as Max's reframe requires. Sharp-accel happens at the cruise-ramp-up moment on ordinary departures (leg-start-plus-small-epsilon, still inside `phase === 'traveling'`); fires there identically. Warp-exit legs (`legIsWarpExit === true`) suppress accel-side firing (the sharp-accel event happened inside the portal, not in this leg) — easiest surface: add `&& (!motionFrame.legIsWarpExit || _tremorInDecelBand)` to the onset-gate, where `_tremorInDecelBand` is derived from signed `dSpeed` at onset. Decel on warp-exit arrival fires normally. Short hops (`legIsShort`) remain silent at the architectural level (phase-gate includes `!legIsShort`).

**2. Surface model — rotation-only on camera, not translation.** ShipChoreographer's shake output API changes: instead of a `shakeOffset: Vector3` positional offset, it emits `shakeQuaternion` (or equivalently `shakeEuler: {pitch, yaw, roll}` — working-Claude picks the representation that composes cleanly with existing camera math; PM leans toward Euler-triple for trivial axis-weight tunability but defers to whoever writes the FlythroughCamera composition). `FlythroughCamera` consumes the rotation and composes it into `camera.quaternion` **AFTER `lookAt()` has run** — post-multiply the shake rotation onto the look-at-derived camera orientation so the shake lives in camera-local space (pitch in camera-local x, yaw in camera-local y, roll in camera-local z), not world space. `camera.position` is NEVER mutated by the shake mechanism — this is the invariant that fixes "planets are bouncing." A pinned background star should render at the same world-space pixel location across a tremor-active frame and a pre-tremor frame; only the camera's heading jitters. AC #19 below is the programmatic check for this invariant.

**3. Envelope model — 1–2s sustained tremor with ramp-in/ramp-out, asymmetric amplitude curve.** The authored experience per event:

```
amplitude(t) = env_curve(t) × carrier(t, freq, phase)
```

where:
- `env_curve(t)` is a smooth amplitude envelope over the event's duration (V1 seed duration: `TREMOR_ENVELOPE_DURATION = 1.5` seconds, tunable `[1.0, 2.0]`). For **accel events** (crescendo-then-fade): ramp-in `[0, 0.25]` of duration from 0 → peak × 0.3, sustain `[0.25, 0.6]` at peak × 1.0 (the "breaking through" window), ramp-out `[0.6, 1.0]` at peak × (1.0 → 0). For **decel events** (impact-then-decay): fast ramp-in `[0, 0.1]` from 0 → peak × 1.0 (the "impact" window), long ramp-out `[0.1, 1.0]` from peak × 1.0 → 0 following a smoothstep or exponential decay (the "rings out" window). These curves encode the §8H asymmetry as envelope-shape, not as bounce-count. Exact shapes at authored numeric form live at the top of `ShipChoreographer.js` — see §4 tunable surface.
- `carrier(t, freq, phase)` is the high-frequency tremor itself. Director's V1 estimate: **15–25 Hz visual carrier frequency** per axis (high enough to read as turbulence, low enough to stay observable on 60fps capture). Per-axis phase is independently offset so pitch and yaw don't synchronize into an obvious oval — use `Math.sin(2π × freq × t + phase_offset[axis])` or a cheaper band-limited noise; implementation detail for working-Claude.

Per-event state frozen atomically at `_startTremorEvent()`: event-type (accel|decel), onset-time, duration, peak-amplitude-per-axis (snapshot of the tunable constants at onset — Max might edit them mid-tour, but an in-flight event runs on the values it started with).

**4. Tunable surface — exposed constants for Max's "configurable so we can adjust" ask.** At the top of `src/auto/ShipChoreographer.js`, named and documented:

- `TREMOR_ENVELOPE_DURATION = 1.5` — seconds. Bounded `[1.0, 2.0]` per Max's Q1.
- `TREMOR_CARRIER_FREQ_HZ = 20` — carrier frequency per axis. V1 seed; Max tunes during review.
- `TREMOR_PITCH_PEAK_DEG = 1.0` — peak pitch (camera-local x) rotation amplitude. V1 seed `[0.5, 1.5]`.
- `TREMOR_YAW_PEAK_DEG = 1.0` — peak yaw (camera-local y) rotation amplitude. V1 seed `[0.5, 1.5]`.
- `TREMOR_ROLL_PEAK_DEG = 0.5` — peak roll (camera-local z) rotation amplitude. Smaller default since roll reads as a "cockpit banking" cue that Max may want subtler than pitch/yaw.
- `TREMOR_ACCEL_SHAPE = 'crescendo-fade'` (or the curve-constant name): identifies the accel envelope shape.
- `TREMOR_DECEL_SHAPE = 'impact-decay'`: identifies the decel envelope shape.
- `SIGNAL_ONSET_THRESHOLD` — `|d|v|/dt|` magnitude that triggers a new event. Tuned against Sol tour's typical peak `|d|v|/dt|` (the round-6/7 era threshold range is a V1 starting point; working-Claude tunes empirically via telemetry).
- `SIGNAL_EVENT_COOLDOWN = 0.5` — seconds. Minimum gap between consecutive events of the same type on the same leg, to prevent a single sharp-motion window from firing multiple tremors.

Each constant is **documented in a comment block** with its role, bounded range, and Max-tunes-during-review note, so Max can `F12` into the source and edit during playback review. This is the "configurable so we can adjust" deliverable.

**5. Belt-and-suspenders sampling gate.** Round-9's failure #2 (dog-with-fleas orbit shake) happened because the trigger surface correctly declined to fire in orbit, but the sampling loop didn't check: an event that fired at the end of a `traveling` segment kept ringing out as the phase transitioned into `approaching` → `orbiting`. Round-10 guards at BOTH surfaces:

- **Trigger-side gate** (§1 above): `phase === 'traveling' && !legIsShort` gates onset-detection — new events can't start outside `traveling`.
- **Sampling-side gate** (new in round-10): `ShipChoreographer.update(dt, motionFrame)` — if `motionFrame.phase !== 'traveling'` AND a tremor event is currently active, the event aborts immediately. `shakeQuaternion` is reset to identity (zero rotation); the event's remaining duration is discarded. This catches any in-flight ringout that the trigger-side gate can't touch (because the event was started correctly in `traveling` but the phase transitioned mid-event). Belt-and-suspenders: an event can't start outside `traveling`, AND an event that somehow outlived `traveling` is silenced at sampling time.

**6. Debug hooks — re-shaped for tremor events.** `debugAccelImpulse()` / `debugDecelImpulse()` entry points on `window._autopilot` retained as the eyeball-evaluable evaluation surface for AC #4 asymmetry (now refined to "asymmetric envelope-shape over the tremor carrier"). Each call enqueues a `_startTremorEvent(type)` at the next update tick with the full envelope duration + carrier + peak amplitudes pulled from the tunable constants. Debug fires bypass the phase-gate and distance-gate (unconditional, per scaffolding convention from round-8/9). The `debugImpulseAtOrbitDistance(c2t, sign)` entry point from round-9 is retired — `c2t` was a scene-unit-translation scaling concept and has no role in rotation-only shake.

### Round-10 ACs

ACs #1, #5–#12 from prior rounds either retire or reaffirm; ACs #2 and #4 are rewritten; AC #3 is rewritten again; ACs #13, #14, #15 from round-9 carry forward with minor rewording; ACs #16–#19 are new — the four telemetry-invariant ACs Director mandated to close the round-9 spec-class gap.

1. **[RETIRED — superseded by #17 + #18].** Single-axis shake. Round-10 is three-axis rotation (pitch + yaw + roll), not one axis; single-axis was a concept tied to the pebble/boat translation metaphor. The new surface-invariant AC is #19 (rotation-not-translation), and the new axis-semantics AC is #17 (shake coincides with signal, not stray ringout).
2. **[RETIRED — superseded by #4 reaffirmed + §8H amendment].** 3–5 discrete log-spaced bounces. Max retired the bounce-count semantics via Q2; §8H amended to canonize tremor rendering. New envelope-shape ACs are the reaffirmed #4 (asymmetric envelope curves) + #16 (event duration).
3. **[REWRITTEN — round-10 form].** Trigger is **continuous `|d|v|/dt|` signal, phase-gated to `motionFrame.phase === 'traveling' && !motionFrame.legIsShort`**. Accel-event trigger additionally requires `!motionFrame.legIsWarpExit` (portal pre-loaded the sharp-accel); decel-event trigger has no warp-flag condition. The signal is computed as `|d|v|/dt|` from position-delta over the frame; the sign of `d|v|/dt` at onset picks accel vs. decel envelope. Verified: (a) an autopilot leg with `!legIsShort && !legIsWarpExit` fires an accel tremor mid-ramp-up (at or just after the Hermite-ease's `t ∈ [0.2, 0.4]` sharp-accel window) and a decel tremor mid-ramp-down (at or just after `t ∈ [0.6, 0.8]` sharp-decel window), not at segment boundaries; (b) a leg with `legIsShort === true` fires neither; (c) a leg with `legIsWarpExit === true` fires no accel but fires decel on the arrival-side sharp-motion window; (d) the code path from MotionFrame to `_startTremorEvent` runs ONLY while `phase === 'traveling'` — the onset-detector does not execute outside that phase-gate.
4. **[REWRITTEN — envelope-shape form].** Accel tremor and decel tremor are **visibly, temporally asymmetric in their amplitude envelope over the tremor carrier**. Accel envelope: crescendo-then-fade — slow ramp-in, sustain at peak, ramp-out. Decel envelope: impact-then-decay — fast ramp-in to peak, long exponential/smoothstep ramp-out. The underlying carrier (high-frequency tremor) is the same; what differs is the envelope curve multiplying it. Verified: back-to-back `debugAccelImpulse()` / `debugDecelImpulse()` recording shows the accel event building up and tapering while the decel event hits hard and rings out. Diagnostic backup via AC #16 telemetry: the `amplitude_envelope(t)` profile sampled at 60fps across the event's duration matches the authored shape within tuned tolerance.
5. **[UNCHANGED from round-1].** WS 2 invariants preserved — zero shake during smooth motion, debug hooks trigger visible shake, FlythroughCamera integration unchanged AT ITS INPUT contract (the consumer now reads a rotation instead of a position offset, which IS a contract change — but the `setShakeProvider` hook pattern and the tour-lifecycle calls stay). The "zero shake during smooth motion" clause is now: the rotation delta from shake is identity (zero rotation) during smooth motion frames.
6. **[UNCHANGED].** Bible + Contract refinement flagged for Director. Round-10 already landed the Bible §8H tremor-shape amendment (committed in the same PM pass as this brief amendment) — listed under §"Round-10 director actions" below for symmetry. `docs/SYSTEM_CONTRACTS.md` §10.8 update to reflect the rotation-surface and continuous-phase-gated-signal trigger remains optional Director-owned work.
7. **[UPDATED — round-10 recording gate].** Motion evidence at ship-gate — one or more canvas recordings per Shipped-gate protocol. Drop path: `screenshots/max-recordings/autopilot-shake-redesign-round10-2026-04-21.webm`. Sequence requirement: at least one full Sol tour with `!legIsShort` legs that exercises natural accel + decel tremor firing, at least one short-hop leg demonstrating silence, at least one debug-triggered `debugAccelImpulse() / debugDecelImpulse()` back-to-back pair for envelope-asymmetry eyeball review. Multiple recordings fine (one for tour, one for debug, one for warp-exit) per round-9's split convention. Working-Claude captures + surfaces contact sheet at ≤1800px per axis; Max evaluates.
8. **[UNCHANGED — round-3 arrival-timing, now subsumed by #3].** Decel tremor fires during the sharp-decel window (mid-to-late Hermite-ease, not at segment-end boundary). Round-10's continuous-signal-during-`traveling` model naturally fires decel during the Hermite's sharp-decel peak, not at the `t=1` boundary where `travelComplete` raises. AC #8's original "fire at orbit-settle, not at approach-start" concern is moot in round-10 — the event fires mid-Hermite, finishes before the Hermite ends, and the ship's actual orbit-entry is shake-silent by phase-gate.
9. **[UNCHANGED].** Telemetry recorder (`window._autopilot.telemetry.start()` / `.stop()`) — extended with four new fields for round-10 (see #16–#19 verification).
10. **[RETIRED — scale-coupling no longer applies].** `orbitDistance`-scaled amplitude. Rotation-only surface doesn't need scene-unit scaling — a 1° pitch rotation reads as the same view-angle regardless of what the camera is framing. The round-4 scale-coupling invariant is retired alongside the translation surface it was guarding.
11. **[UPDATED — telemetry fields re-scoped].** Multi-body stress-test telemetry. Round-4's `currentTargetOrbitDistance` / `currentTargetBodyRadius` / `cameraToTargetDistance` / `currentTargetType` fields stay as useful context for debugging, but they no longer verify an AC by themselves (AC #10 retired). `shakeQuaternion` / `shakeEuler` replaces `shakeOffset` / `shakeMag` in the sample shape. `|d|v|/dt|` sample (`dSpeed`) retained as the trigger-signal log.
12. **[UPDATED — round-10 recording covers moon arrival].** Moon-arrival in recording still required, for the rotation-on-small-body evaluation (a 1° rotation at a moon is the same view-angle as at a star, but if there's any residual translation contamination it would amplify most at small bodies).
13. **[REAFFIRMED — round-9 orbit-silence, now architectural at BOTH trigger + sampling surfaces].** Shake is inactive (`shakeQuaternion === identity`) for every frame where `motionFrame.phase ∈ {'orbiting', 'approaching', 'descending', 'idle'}`, regardless of `|d|v|/dt|` magnitude, orbit pitch oscillation, orbit breathing, or any other motion signal. Enforced by construction: (a) the onset-detector does not run outside `phase === 'traveling'`; (b) the sampling loop aborts any in-flight event if phase transitions out of `traveling`. See AC #16.
14. **[REAFFIRMED — short-hop silence].** Shake does not fire on any leg where `motionFrame.legIsShort === true`. Enforced at the phase-gate: the `!legIsShort` predicate is part of the onset-detector's enabling condition. Verified via telemetry on a short-hop scenario: `shakeQuaternion === identity` throughout.
15. **[REAFFIRMED — warp-exit asymmetry].** A warp-exit leg (`motionFrame.legIsWarpExit === true`) fires NO accel tremor — the ship coasts at cruise speed from the portal per Max's prior Q3 answer and Bible §8H line 1309's arrival-is-the-event canon. The decel tremor fires normally on the arrival-side sharp-decel window. Verified via a Sol warp-arrival recording: `shakeQuaternion === identity` across the ENTRY/TRAVELING coast; the decel tremor fires mid-decel-ramp.

**[NEW — telemetry-invariant ACs encoding Director's round-10 direction.]**

16. **[NEW] Orbit-shake cross-product is empty.** Across any tour capture, the set of frames where `shakeActive === true` (equivalently: `|shakeEuler.length() | > ε` for a small `ε` — exact ε TBD during implementation, suggest `0.001 rad`) intersected with `motionFrame.phase ∈ {'orbiting', 'approaching'}` must be **empty**. Programmatic check: iterate telemetry samples, filter for `shakeActive && (phase === 'orbiting' || phase === 'approaching')`, assert `.length === 0`. Catches round-9's dog-with-fleas regression class structurally. Runs against any recording capture via `window._autopilot.telemetry.audit.orbitCrossProduct()` (new helper method introduced in the round-10 telemetry extension — returns `{passed: bool, violations: Array<Sample>}` for Director audit).
17. **[NEW] Shake coincides with signal.** Frames where `shakeActive === true` AND `smoothedAbsDSpeed < SIGNAL_ONSET_THRESHOLD` (computed on the same frame or within a small lag window, suggest ±3 frames = 50ms at 60fps) must be **empty**. Catches round-9's "shake at near-zero velocity" bugs (the ship coasting to a stop in front of a star, with the decel tremor firing AFTER the sharp motion has finished). Programmatic check via `window._autopilot.telemetry.audit.signalCoincidence()` — returns violations where shake was active but no significant signal was present. Note: the asymmetric envelope will ring out somewhat beyond the signal peak (the "fade" and "decay" tails are audibly intentional) — the threshold for this AC accounts for envelope-ringout by measuring the signal envelope itself, not the instantaneous value. Exact phrasing: "shake-event ONSETS must coincide with signal onsets; shake-event RINGOUTS may trail the signal by up to the envelope's ramp-out window."
18. **[NEW] Envelope completion constraint.** At any `_startTremorEvent` call, the event's duration at onset must be ≤ remaining `traveling`-phase time at that moment. If the ship is at `t=0.8` of a 10-second travel (2 seconds remaining), envelope duration must be ≤ 2 seconds. Programmatic check: at each event onset, telemetry logs `eventOnsetTime`, `eventDuration`, and `travelingPhaseRemainingTime` (computable from `navigationSubsystem._travelEase` state); audit asserts `eventDuration ≤ travelingPhaseRemainingTime` for every event-start frame. If an event would run past the phase boundary, `_startTremorEvent` must either shorten the event's duration to fit OR decline to fire (working-Claude picks — PM suggests shortening with a minimum-duration floor of 0.5s below which the event is suppressed, since a tremor shorter than 0.5s won't read as turbulence). Catches round-9's "decel envelope rings out into APPROACHING/ORBITING" class. `window._autopilot.telemetry.audit.envelopeFitsPhase()` runs this as a post-capture check.
19. **[NEW] Surface-invariant — rotation not translation.** ShipChoreographer's shake API is `shakeQuaternion` (or `shakeEuler`), NOT `shakeOffset: Vector3` applied to `camera.position`. Programmatic check: working-Claude's telemetry self-audit captures `camera.position` across a tremor-active frame and a pre-tremor frame with the camera on a stable tour-leg (same body target, same `lookAt`, same frame-of-reference). Pinned-star pixel-position comparison should show the background star rendering at the same canvas pixel in both frames (within sub-pixel tolerance for floating-point drift); the camera's orientation — measured as `camera.quaternion` or derived `camera.rotation` — should differ between the two frames. If the pinned-star pixel-position shifts, translation contamination is present and the AC fails. Additional code-level assertion: grep the diff for `camera.position.add(` or `camera.position.copy(... + shake...)` or equivalent — the only writes to `camera.position` in the session's diff should be the orbit-camera / tour-camera math, never a shake-sourced one. Working-Claude includes the grep result in the commit message.

### Round-10 director actions

- **`docs/GAME_BIBLE.md` §8H Gravity Drive — tremor-rendering-shape amendment.** LANDED in the same PM pass as this brief amendment. Commit: `14e1204`. Paragraph inserted after the existing ether paragraph, canonizing (a) rendering as sustained tremor during sharp-motion window not discrete bounces at boundaries, (b) asymmetry as envelope curve over tremor carrier, (c) primary surface as camera rotation not translation. Load-bearing so future rendering-pass readers don't re-open rounds 6–8's reconciliation spiral.
- **`docs/SYSTEM_CONTRACTS.md` §10.8 Gravity-drive shake invariant — optional implementation refinement.** Director's call. The §8H amendment alone could carry round-10 canon; pinning the event-model + rotation-surface in §10.8 would prevent future rendering passes from re-implementing as translation shake. PM does not recommend either way — both are legitimate. Not a gate condition for round-10 release.

### Round-10 in scope

- **Rework `src/auto/ShipChoreographer.js`** — delete the round-9 phase-boundary-listener branches; install continuous `|d|v|/dt|` signal derivation + onset-detector gated on `motionFrame.phase === 'traveling' && !motionFrame.legIsShort` (+ `!motionFrame.legIsWarpExit` on accel-side only); introduce `_startTremorEvent(type, onsetTime, duration)` as the atomic event-starter freezing the event-type, onset-time, duration, per-axis peak amplitudes. Implement the per-frame sampling: if event active AND still in `traveling` phase, emit `shakeEuler = (env(t) × pitch_carrier, env(t) × yaw_carrier, env(t) × roll_carrier)`. If phase transitions out of `traveling`, abort event.
- **Change `shakeOffset` API to `shakeEuler` (or `shakeQuaternion`) on `ShipChoreographer`.** Rename the public property; update JSDoc. Working-Claude picks representation (quaternion composes cleanly; Euler-triple trivially exposes per-axis tunables — PM leans Euler but working-Claude owns the choice).
- **Rework `src/FlythroughCamera.js` shake composition.** Consumer reads the new rotation API. Compose onto `camera.quaternion` AFTER `camera.lookAt(...)` — so the shake lives in camera-local space, not world space. `camera.position` is never mutated by the shake surface. This IS a cross-file edit; explicitly authorized by this amendment. Round-1's drift-risk-4 ("Redesign bleeds into a module rewrite") is preserved — the FlythroughCamera edit is bounded to the shake-composition lines, not a broader refactor.
- **Retire round-8/9 surface** — `ACCEL_AMPS`, `DECEL_AMPS`, `IMPULSE_INITIAL_GAP`, `IMPULSE_SPACING_RATIO`, `SHAKE_VIEW_ANGLE_MAX` (in its round-8 role), `_shakeOnsetCam2Tgt`, `_shakeOnsetSign`, Gaussian bump machinery, `debugImpulseAtOrbitDistance(c2t, sign)`. Working-Claude cites what was deleted in commit message for bisect reference.
- **Extend `window._autopilot.telemetry`** — sample shape additions: `shakeEuler: {pitch, yaw, roll}` (replaces `shakeOffset`); `shakeActive: boolean`; `smoothedAbsDSpeed`: scalar; `eventOnsetTime`, `eventDuration`, `eventType` (when an event is active). Add three audit helpers: `.audit.orbitCrossProduct()` (AC #16), `.audit.signalCoincidence()` (AC #17), `.audit.envelopeFitsPhase()` (AC #18). Each returns `{passed: bool, violations: Array<Sample>}`.
- **Expose the tunable constants** at the top of `ShipChoreographer.js` per §4 of round-10 model. Documented inline for Max's review-time tuning.
- **One commit**, suggested message: `feat(autopilot): rotation-only sustained-tremor shake, signal-gated to traveling phase (round 10)`. Scope: `ShipChoreographer.js` full rework + `FlythroughCamera.js` shake-composition rework + telemetry extension in `main.js`. Single commit because the three files are mutually dependent (old API is fully retired, new API is the only path through).
- **Recording(s) at `screenshots/max-recordings/autopilot-shake-redesign-round10-2026-04-21.webm`** (multiple files permitted per round-9 convention — tour, envelope-demo, warp-exit).
- **Telemetry self-audit BEFORE recording Max sees.** Working-Claude runs the three `.audit.*()` helpers + the AC #19 pinned-star pixel check against a test capture, confirms all four round-10 telemetry-invariant ACs pass programmatically. If any fail, iterate on code before recording Max sees. This is the round-10 guard against the round-9 spec-class miss.
- **Update this brief's Status line** on commit-land from `HELD — ROUND 10 PIVOT ...` → `VERIFIED_PENDING_MAX <sha>` (when commit + recordings + telemetry-audit-passing capture land) → `Shipped <sha> — verified against <recording-paths>` (after Max's verdict).

### Round-10 out of scope

- **Retuning envelope constants after initial authoring.** V1 seed values (`TREMOR_ENVELOPE_DURATION = 1.5s`, `TREMOR_CARRIER_FREQ_HZ = 20`, peak degrees `[1.0, 1.0, 0.5]`) are Max-tunable at review time. If the recording shows they need Max's adjustment, that's Max editing the constants during review — not a round-11 patch.
- **Porting shake to other camera surfaces.** Only `FlythroughCamera` consumes the shake. Free-flight camera, manual-override camera, etc. are V-later.
- **Audio coupling.** Shake events raising audio-trigger events for a future sting/rumble cue are still V-later (round-1 §Out of scope).
- **`NavigationSubsystem.js` changes beyond what round-9 authorized.** MotionFrame's `legIsShort` and `legIsWarpExit` fields are already in place from round-9 (commit `992cbb2`). Round-10 does not add new MotionFrame fields. If the implementation needs something else from the subsystem, that's scope drift — escalate to PM.
- **New `ShakeEngine` module.** Still V-later per round-1 drift-risk 4.

### Round-10 drift risks

- **Risk: Translation contamination — a single `camera.position.add(shake...)` slips in during the FlythroughCamera rework and AC #19 fails.**
  **Why it happens:** "composing shake into the camera" is a single mental operation that has two very different code realizations (position vs. orientation); the off-the-shelf camera-shake code in most engines does translation, and autocomplete/muscle-memory favors that path.
  **Guard:** AC #19 is the programmatic check. Working-Claude greps the diff for any `camera.position.` write path introduced in the shake code, confirms it's zero, cites the grep in the commit message. Pinned-star pixel check runs as telemetry self-audit before Max sees the recording.

- **Risk: Signal onset-detection fires inside orbit because the phase-gate is implemented as a guard after signal derivation, not as an early return.**
  **Why it happens:** defensive coding order — "derive the signal for telemetry, then check the gate" feels cleaner than "gate first, derive only inside the gate." But in practice, an exception or a bug in the gate-check could leave a signal-derivation sneaking a `_startTremorEvent` call through before the gate short-circuits.
  **Guard:** the onset-detector's entry branch is `if (motionFrame.phase !== 'traveling' || motionFrame.legIsShort) return;` at the TOP of the function. Signal-derivation runs only inside the gate. AC #16 catches any leak programmatically.

- **Risk: Sampling-gate aborts an in-flight event but forgets to reset `shakeEuler` to identity, leaving stale values on the camera.**
  **Why it happens:** the "abort event" mental operation is one thing; the "zero the output" mental operation is another; they must both happen but code-wise they can be separated.
  **Guard:** the abort path in `update()` does both in the same code block: `this._tremorEventActive = false; this.shakeEuler = {pitch: 0, yaw: 0, roll: 0};` (or `this.shakeQuaternion.identity()`). AC #13 telemetry catches any frame where phase is not `'traveling'` but `shakeEuler.length() > ε`.

- **Risk: Envelope duration hard-coded at 1.5s overflows short `traveling` phases.**
  **Why it happens:** short-but-non-short-hop legs exist (the `_isShortTrip` predicate is a threshold; a leg with `dist = 31` is `!isShortTrip` but its `traveling` phase could be <1.5s). The event would start, run, and ringout past the phase boundary.
  **Guard:** AC #18 encodes this invariant and the event-starter consults `travelingPhaseRemainingTime` at onset, either shortening to fit or suppressing below the 0.5s floor.

- **Risk: Per-axis carrier frequencies synchronize into a visually obvious oval or circle pattern.**
  **Why it happens:** three identical-frequency sines with incidental phase relationships produce Lissajous figures; 20Hz + 20Hz + 20Hz without varied phase offsets will lock into a repeating orbit-shape that reads as a mechanical wobble, not turbulence.
  **Guard:** per-axis phase offsets (e.g., `Math.sin(2π × freq × t + pitch_phase)`, different phases for yaw and roll). Alternative: per-axis slight frequency detuning (`pitch_freq = 20Hz`, `yaw_freq = 22Hz`, `roll_freq = 19Hz`) which naturally decorrelates. Working-Claude picks; PM's V1 suggestion is phase-offset detuning since that's cheaper and easier to tune.

### Gate release condition

Director re-audits this amendment (fifth audit on this workstream) and verifies:
1. Trigger model (continuous signal phase-gated to `traveling`) is unambiguous — §Round-10 model #1.
2. Surface model (rotation on camera, not translation) is pinned with AC #19 as the programmatic gate.
3. Envelope model (sustained tremor with asymmetric amplitude envelope over high-frequency carrier) replaces the round-8/9 log-impulse-train verbatim — §Round-10 model #3.
4. Tunable constants are exposed per §Round-10 model #4 to honor Max's "configurable so we can adjust" ask.
5. Belt-and-suspenders sampling gate is present — §Round-10 model #5.
6. ACs #16, #17, #18, #19 are authored as the telemetry-invariant close for the round-9 spec-class gap.
7. Bible §8H amendment is committed (LANDED at `14e1204`).

If audit passes, gate releases scoped to the round-10 commit. State updates to `{ "edits": 0, "last_audit_sha": "<pm-amendment-sha>" }` on release. Working-Claude does NOT edit code until Director audit lands.

Drafted by PM 2026-04-21 as the round-10 pivot amendment, following Max's three verbatim Q&A answers (envelope 1–2s subtle; shape sustained tremor like aircraft turbulence; axes pitch/yaw/roll configurable) and Director's §"Round-9 REJECTED — retry" direction. Bible §8H committed separately at `14e1204`.
