# Workstream: Autopilot gravity-drive shake redesign — rotation-only sustained tremor (2026-04-21)

## Status

`Shipped 1bb5eb2 — verified against screenshots/max-recordings/autopilot-shake-redesign-round11-2026-04-22.webm + Max's own tour playback 2026-04-23.` Max explicit verdict 2026-04-23: *"shipped, continue."* On round-11's per-leg fire budget he reported: *"The bug where a shake happened upon arrival into orbit seems fixed."* Prior concerns about orbit bouncing, rubber-band feel, scene-translation, and multi-fire-per-transit all structurally resolved across rounds 9–11; round-11 capped the fire count at 2 per TRAVELING phase via the per-leg budget + debug-exclusion AC fix.

**Round-11 self-audit results (all four telemetry ACs passed programmatically):**
- AC #16 `orbitCrossProduct`: PASS (0 violations — natural shake outside orbit/approach empty).
- AC #17 `signalCoincidence`: PASS (0 violations — natural shake coincides with signal window).
- AC #18 `envelopeFitsPhase`: PASS (0 violations — natural events stay within TRAVELING phase).
- AC #20 `perLegFireBudget`: PASS (0 violations — natural events ≤1 accel + ≤1 decel per leg).

**Recording drop path:** `screenshots/max-recordings/autopilot-shake-redesign-round11-2026-04-22.webm` (~13 MB, 30s Sol D-shortcut tour + debug-fire pair).

**WS 2 parking-lot dependency satisfied.** The shake-redesign item in WS 2's parking lot is closed. The other WS 2 parking-lot item (STATION darkside-always) remains open — not a shake-redesign dependency and has its own schedule.

**Adjacent items surfaced during review, parked separately (not shake-redesign scope):**
- `docs/WORKSTREAMS/autopilot-approach-orbit-continuity-2026-04-22.md` — Drafted workstream for nav-layer velocity continuity at APPROACH→ORBIT. Max reported the hitch as "seems fixed" at round-11 review — the continuity brief may be moot or reduced scope; re-evaluate when activated.
- `docs/FEATURES/autopilot.md` §"Parking lot" (commit `79cdf4e`) — Travel-feel speed-field issue (planet↔moon "one gear" feel per Max, reference Elite Dangerous Supercruise). Parked at feature-doc level; awaits speed-field articulation before PM scopes execution.
- **Shake-at-random concern (Max, 2026-04-24 continuity review):** *"The camera shake does not seem to be at all choreographed with the acceleration and deceleration. It feels like it happens kind of at random points."* **Deferred to loop (c) of `docs/WORKSTREAMS/autopilot-live-feedback-2026-04-24.md`** — the live-feedback workstream augments the round-10/11 onset gate with a local-maximum detector on `_smoothedAbsDSpeed` so onsets fire at actual velocity-change peaks, not at any threshold crossing. Shake mechanism (envelope shape, carrier frequency, rotation surface, per-leg budget, cooldown) is NOT changed — only the signal-trigger predicate. This workstream does NOT reopen; the fix lives in the live-feedback workstream's scope per Principle 2 (one trigger-signal change, not a mechanism re-author).

**Ship summary:**
- Final code commit: `1bb5eb2` (per-leg fire budget).
- Canonical canon: `docs/GAME_BIBLE.md` §8H Gravity Drive (amended round-10 at `14e1204`).
- Total rounds: 11. Round 10 was the winning mechanism pivot (continuous signal + phase-gate + rotation-only surface + asymmetric envelope over high-freq carrier); round 11 capped fire count at 2 per leg. Rounds 1–9 history preserved in `## Appendix: Round history`.

---

**Historical: HELD state (superseded by round-11 code commit 1bb5eb2).**

`HELD — ROUND 11 PIVOT (per-leg fire budget: 1 accel + 1 decel max per TRAVELING phase)` — Director held the workstream after Max watched round-10 and reported the shake firing 3–4 times per planet-planet transit instead of the intended 2 (once at burn-start, once at burn-end).

**Max's round-10 feedback (2026-04-22, verbatim):**

> "there is a slight 'jump' that happens now after we have arrived at a planet's orbit... at the moment when the ship stops, between the arrival and orbiting phases, there's a little hitch. otherwise, this is looking a lot better--the shake effect works well. but I notice it happens something like 3 times in each planet-planet transit, sometimes 4. it should really only happen twice--once when the 'burn' really commences to get us into cruise, then once again to take us out of cruise once we're almost at the planet."

**Director's diagnosis (full at `~/.claude/state/dev-collab/audits/autopilot-shake-redesign-2026-04-21.md`):**
The Hermite travel's arrival-blend window (`ARRIVE_BLEND = 2-3.5s` before travel-end, in `NavigationSubsystem._updateTravel` lines 758–767) produces **two distinct `|d|v|/dt|` peaks during decel** — one at blend-start (Hermite deceleration + arrival-curve introduction), one at blend-complete (`blend → 1` and orbit-tangential motion dominates). Combined with the accel-fire at leg-start, that's 3 natural fires. On longer legs the two decel peaks separate enough to produce a 4th pattern. The round-10 `SIGNAL_EVENT_COOLDOWN = 0.5s` is short enough that the second decel peak crosses threshold after the first event's cooldown has elapsed, allowing a second decel fire within the same leg.

**Round-11 fix (surgical, ~5 lines):**

Add a per-leg fire budget on top of the existing cooldown. Reset on the `motionStarted` one-shot from MotionFrame (new leg begins); at most 1 accel-type and 1 decel-type event may fire per TRAVELING phase of a single leg. Debug fires bypass the budget (unconditional scaffolding).

Implementation:

1. `ShipChoreographer` constructor: add `this._firedThisLeg = { accel: false, decel: false }`.
2. `ShipChoreographer.update()` top-of-loop: when `motionFrame.motionStarted === true`, reset `this._firedThisLeg.accel = false; this._firedThisLeg.decel = false`.
3. Onset-detection branch: in addition to `cooldownOk && warpExitOk`, gate on `!this._firedThisLeg[type]`.
4. `_startTremorEvent(type, isDebug)`: if `!isDebug`, set `this._firedThisLeg[type] = true`.
5. `_resetState()`: zero the per-leg flags alongside other state.

Encodes Max's stated model literally: "once when the burn commences, once to take us out of cruise." No mechanism redesign — Max's feedback said "otherwise this is looking a lot better." Round-11 is a single-constraint tightening.

**Bible §8H stays unchanged.** §8H canon is "shake fires on sharp-motion transitions"; per-leg budget is an implementation refinement to honor the authored "once per transition edge" intent, not a canonical change.

**Round-11 ACs:**

- **Reaffirm AC #3** with budget refinement: at most 1 natural accel event AND 1 natural decel event per TRAVELING phase. Debug fires do not consume budget. Budget resets on `motionStarted`.
- **Add AC #20: per-leg fire budget.** Across any telemetry capture, for each contiguous TRAVELING segment (between a `motionStarted === true` frame and the next phase transition), count distinct natural event onsets (`eventIsDebug === false`, filtered by `eventType`). Assert: accel-count ≤ 1 AND decel-count ≤ 1 for every such segment. Programmatic: new `window._autopilot.telemetry.audit.perLegFireBudget()` returning `{passed, violations: [{legStartTime, accelCount, decelCount}, ...]}`. Debug fires are excluded by construction (`eventIsDebug === true` filter).

**Round-11 scope (working-Claude authorization):**

- `src/auto/ShipChoreographer.js` — add `_firedThisLeg` state + reset + gate + event-fire-set. ~5–8 lines total.
- `src/main.js` — add `.audit.perLegFireBudget()` helper + include in `.audit.runAll()`. ~20 lines.
- No changes to `FlythroughCamera.js`, `NavigationSubsystem.js`, or the round-10 envelope/carrier/surface math.

**Round-11 recording drop path:** same file as round-10 for append or a fresh round-11 file. Max's hand-evaluated check is "2 shakes per long leg, not 3–4." Programmatic AC #20 covers the same check.

**The hitch Max also flagged is NOT in round-11 scope.** Director's diagnosis: it's a pre-existing nav-layer velocity discontinuity at APPROACH→ORBIT transition (near-zero radial velocity at approach-end, instant-nonzero tangential velocity at orbit frame 1). Round-9's violent shake masked it; round-10's subtle shake surfaced it. A separate workstream brief at `docs/WORKSTREAMS/autopilot-approach-orbit-continuity-2026-04-22.md` covers the fix; it is NOT a shake-redesign dependency and does NOT block the shake-redesign Shipped flip.

Gate is engaged. Code does not resume until Director re-audits this amendment.

*(Brief authored in degraded-mode by working-Claude on 2026-04-22 after the PM agent's stream timed out mid-amendment. Director direction from audit file is the canonical source; this amendment is working-Claude's PM-proxy authoring. Any disagreement between this text and the Director audit → Director audit wins.)*

---

**Historical: VERIFIED_PENDING_MAX (round-10, superseded by round-11 pivot).**

`VERIFIED_PENDING_MAX 34d6d98` — round-10 code committed. Rotation-only sustained tremor, signal-gated to TRAVELING phase with belt-and-suspenders sampling gate. Canonical surface: `camera.position` is never mutated by shake — a quaternion post-multiply is applied AFTER `camera.lookAt()`, so only the viewport heading jitters.

**Self-audit results (all four round-10 telemetry ACs passed programmatically before recording surfaced):**
- AC #16 `orbitCrossProduct`: PASS (0 violations — no shake during orbiting/approaching phases).
- AC #17 `signalCoincidence`: PASS (0 violations — no shake outside signal window; debug fires excluded as authored).
- AC #18 `envelopeFitsPhase`: PASS (0 violations — no event extends past TRAVELING phase).
- AC #19 surface-invariant (code grep): PASS — only documentation comments reference `camera.position` in the shake context; no code path writes to it from shake.

**Recording drop paths:**
- `screenshots/max-recordings/autopilot-shake-redesign-round10-2026-04-21.webm` — Sol D-shortcut tour with a debug-fire pair embedded. Short recording (~40s wall, ~322KB on disk) — Well Dipper's canvas only re-renders during active motion/shake, so the recorded frames are the motion moments only. Shows orbit silence + short-hop silence + debug-triggered accel/decel tremor.

**Observational gap (brief-level disclosure, code-path verified):** The Sol D-shortcut tour used for the capture runs all short-hop legs (`isShortTrip === true` throughout), so no natural accel/decel tremor fired during the capture — the captured shake events are the debug-hook fires. The natural-fire code path exists and is exercised by AC #3's programmatic check (the onset-detector runs only inside the `traveling && !isShortTrip` gate; the gate derivation is covered by AC #16). A future Sol warp-arrival tour would exercise the natural decel path at `TRAVELING → APPROACHING`; that capture is follow-up evidence, not an AC closure precondition. AC #3's "verified" clauses on natural-fire read as **code-verified** for round-10; observational-natural-fire is a next-review item for a later session when warp-to-star flow is being exercised anyway.

**Tunables exposed at top of `src/auto/ShipChoreographer.js`** — see `## How to tune` below.

Awaiting Max's verdict on the round-10 recording.

---

## Parent feature

**`docs/FEATURES/autopilot.md`** — §"Gravity drives — ship-body shake on abrupt transitions" (lines 194–204). This workstream also inherits **WS 2's AC #5** (`docs/WORKSTREAMS/autopilot-ship-axis-motion-2026-04-20.md`) as a preserved invariant across the redesign: *"Gravity-drive shake fires on genuinely abrupt motion; does NOT fire during smooth motion."*

**Lore anchor:** `docs/GAME_BIBLE.md` §8H Gravity Drive (In-System Propulsion), lines 1290–1309 + the round-10 tremor-shape amendment (commit `14e1204`). §8H canonizes rendering as sustained tremor during the sharp-motion window (not discrete bounces at boundaries), asymmetry as envelope curve over tremor carrier, and primary surface as camera rotation (not translation).

**Contract anchor:** `docs/SYSTEM_CONTRACTS.md` §10.8 Gravity-drive shake invariant. §10.8 refinement to reflect rotation-surface + continuous-phase-gated-signal trigger is flagged under §"Director actions" below; it is **not** a round-10 gate condition (§8H alone carries round-10 canon).

## Implementation plan

N/A (feature is workstream-sized — a targeted rework inside `src/auto/ShipChoreographer.js` + a bounded edit to `src/FlythroughCamera.js`'s shake-composition region + a telemetry extension in `src/main.js`).

## Scope statement

Redesign the gravity-drive shake so it reads as Max's verbatim ask (*"a 1-2 second shake that's subtle... high-frequency small-amplitude tremor, like aircraft turbulence"* — 2026-04-21 round-10 Q&A). The canonical surface is camera **rotation** (pitch/yaw/roll quaternion offsets applied after `lookAt`), not camera position. The trigger is the continuous signal `|d|v|/dt|`, phase-gated to `motionFrame.phase === 'traveling' && !motionFrame.isShortTrip` (`!warpExit` also gates the accel-side). The envelope is a sustained 1–2s tremor — `amplitude(t) = env_curve(t) × carrier(t, freq, phase)` — with asymmetric `env_curve` between accel (crescendo-then-fade) and decel (impact-then-decay), and a high-frequency sinusoidal carrier per axis (slight per-axis frequency detuning + phase scatter to prevent Lissajous lock).

This is one unit of work because trigger, envelope, and surface are mutually dependent — the rotation surface renders a carrier-based tremor as judder-in-the-cockpit, while a translation surface would render the same math as scene-bouncing; the signal-gate is what prevents orbit-phase motion from reading as sharp-accel; the envelope is what distinguishes the asymmetric felt character of accel-vs-decel.

## How it fits the bigger picture

Advances `docs/GAME_BIBLE.md` §8H (as amended round-10). Max's round-10 reframe — shake is *turbulence in the cockpit*, not *the scene bouncing around the ship* — makes the shake a specific authored felt-experience moment rather than a generic "camera shake" ported from action-game convention. Discover / autopilot works because the player feels they are traversing a composed world; round-9's scene-bouncing undercut that with rubber-band artifacts, and round-10 restores the composed reading.

Specifically advances Principle 2 (No Tack-On Systems): shake is produced by an authored model of drive-vs-medium friction (signal-gated tremor) and the renderer (camera-local rotation) just displays it. And Principle 6 (First Principles Over Patches): round-10 retired the round-8/9 log-impulse-train surface wholesale rather than patching its trigger — the shape itself was the drift, not the threshold.

## Acceptance criteria (round-10, consolidated)

This is the consolidated, shipped-model AC list. ACs #1 and #2 are retired (bounce-count and single-axis semantics no longer load-bearing under the rotation-tremor model); ACs #3 and #4 are the current round-10 forms. ACs #13–#19 are the round-9-and-round-10 telemetry/invariant ACs. Earlier rounds' AC numbering is retained for audit-trail traceability; see `## Appendix: Round history` for how the list evolved.

**1. [RETIRED round-10].** Single-axis shake. Round-10 is three-axis rotation (pitch + yaw + roll), not one axis; single-axis was tied to the pebble/boat translation metaphor which Max retired in his round-10 Q2 answer ("high-frequency small-amplitude tremor, like aircraft turbulence"). Axis-semantics are now covered by AC #17 (shake coincides with signal) + AC #19 (rotation-not-translation).

**2. [RETIRED round-10].** 3–5 discrete log-spaced bounces. Max retired bounce-count semantics via Q2; `docs/GAME_BIBLE.md` §8H amended (commit `14e1204`) to canonize sustained tremor. Envelope-shape semantics now live in AC #4 (asymmetric envelope curves) + AC #16 (event duration fits phase).

**3. [ACTIVE, round-10 form] Trigger is continuous `|d|v|/dt|` signal, phase-gated to `motionFrame.phase === 'traveling' && !motionFrame.isShortTrip`.** Accel-event trigger additionally requires `!motionFrame.warpExit` (portal pre-loaded the sharp-accel); decel-event trigger has no warp-flag condition. The signal is computed as `|d|v|/dt|` from position-delta over the frame, smoothed α=0.15; the sign of `d|v|/dt` at onset picks accel vs decel envelope. Verified (round-10): (a) the phase-gate derivation is a top-of-function early-return, so signal-derivation runs only inside the gate (drift-risk-2 guard, grep-confirmed); (b) a leg with `isShortTrip === true` fires neither accel nor decel (AC #16 telemetry covers the orbit/approach cross-product; short-hop silence is the same predicate); (c) a leg with `warpExit === true` fires no accel (architectural predicate in the onset-gate); (d) debug fires bypass gates, per the scaffolding convention. **Observational natural-fire verification deferred** — see Status block above for rationale; code-path verification passes.

**4. [ACTIVE, envelope-shape form] Accel tremor and decel tremor are visibly, temporally asymmetric in their amplitude envelope over the tremor carrier.** Accel envelope: smoothstep ramp-in `[0, 0.6 × dur]` to peak, smoothstep ramp-out `[0.6 × dur, dur]` — crescendo-then-fade. Decel envelope: fast smoothstep ramp-in `[0, 0.1 × dur]` to peak, exponential decay thereafter — impact-then-decay. Underlying carrier is identical; the envelope curve differs. Verified (round-10): back-to-back `debugAccelImpulse()` / `debugDecelImpulse()` in the recording shows the accel event building up and tapering while the decel event hits hard and rings out.

**5. [ACTIVE, WS 2 preserved invariants]** Zero shake during smooth motion, debug hooks trigger visible shake, FlythroughCamera integration unchanged at its input contract. The consumer now reads a rotation (`shakeEuler`) instead of a position offset (`shakeOffset`); the `setShakeProvider` hook pattern and the tour-lifecycle calls (`beginTour`, `onLegAdvanced`, `stop`) are unchanged. "Zero shake during smooth motion" means the rotation delta is identity during smooth-motion frames.

**6. [ACTIVE, process]** Bible + Contract refinement flagged for Director. `docs/GAME_BIBLE.md` §8H tremor-rendering amendment LANDED at commit `14e1204`. `docs/SYSTEM_CONTRACTS.md` §10.8 refinement remains optional Director-owned work — not a round-10 gate condition.

**7. [ACTIVE, round-10 recording gate] Motion evidence at ship-gate.** One or more canvas recordings per `docs/MAX_RECORDING_PROTOCOL.md`. Drop path: `screenshots/max-recordings/autopilot-shake-redesign-round10-2026-04-21.webm`. Round-10 recording must include a debug-triggered `debugAccelImpulse()` / `debugDecelImpulse()` back-to-back pair for envelope-asymmetry eyeball review, plus at least one short-hop leg demonstrating silence. Natural long-leg accel/decel capture is an optional enhancement; see Status block for the code-verified vs observational disposition.

**8–12. [ROLLED UP into round-10 form].** The round-3 arrival-timing AC (#8) is subsumed by AC #3 (signal fires mid-Hermite, not at boundaries). The round-3 telemetry recorder AC (#9) is subsumed by AC #11 + round-10's telemetry extensions. The round-4 scale-coupling AC (#10) is retired entirely — a 1° rotation reads the same at a moon as at a star, so scene-unit scaling no longer applies. AC #11 (multi-body stress-test telemetry) and AC #12 (moon arrival in recording) remain in reduced form — telemetry context fields stay useful for debugging, moon-arrival-in-recording remains a diagnostic for any residual translation contamination.

**13. [ACTIVE, round-9 reaffirmed].** Orbit-silence, architectural at BOTH trigger + sampling surfaces. `shakeEuler === identity` for every frame where `motionFrame.phase ∈ {'orbiting', 'approaching', 'descending', 'idle'}`, regardless of `|d|v|/dt|` magnitude. Enforced by construction: (a) onset-detector does not run outside `phase === 'traveling'`; (b) sampling loop aborts any in-flight event if phase transitions out of `traveling`. Covered programmatically by AC #16.

**14. [ACTIVE, round-9 reaffirmed].** Short-hop silence. No shake fires on any leg where `motionFrame.isShortTrip === true`. Enforced at the phase-gate.

**15. [ACTIVE, round-9 reaffirmed].** Warp-exit asymmetry. A warp-exit leg fires NO accel tremor (portal handed ship cruise speed; §8H arrival-is-the-event canon). Decel tremor fires normally on the arrival-side sharp-decel window.

**16. [ACTIVE, round-10 telemetry-invariant] Orbit-shake cross-product is empty.** Across any tour capture, `{frames where shakeActive} ∩ {frames where phase ∈ 'orbiting' | 'approaching'} = ∅`. Programmatic: `window._autopilot.telemetry.audit.orbitCrossProduct()` returns `{passed: bool, violations: [...]}`. **Result at `34d6d98`: PASS, 0 violations.**

**17. [ACTIVE, round-10 telemetry-invariant] Shake coincides with signal.** Frames where `shakeActive === true` AND `smoothedAbsDSpeed < SIGNAL_ONSET_THRESHOLD` (within ±3-frame lag) are empty. Debug fires excluded as authored. Shake-event ringouts may trail the signal by up to the envelope's ramp-out window. Programmatic: `window._autopilot.telemetry.audit.signalCoincidence()`. **Result at `34d6d98`: PASS, 0 violations.**

**18. [ACTIVE, round-10 telemetry-invariant] Envelope completion constraint.** At any `_startTremorEvent` call, `eventDuration ≤ travelingPhaseRemainingTime`. If an event would run past the phase boundary, the event-starter shortens duration to fit OR suppresses below a 0.5s floor. Programmatic: `window._autopilot.telemetry.audit.envelopeFitsPhase()`. **Result at `34d6d98`: PASS, 0 violations.**

**19. [ACTIVE, round-10 surface-invariant] Rotation not translation.** `ShipChoreographer` emits `shakeEuler` (or equivalently `shakeQuaternion`); `camera.position` is never mutated by the shake mechanism. Programmatic: (a) pinned-star pixel-position check across tremor-active vs pre-tremor frames; (b) grep the diff for `camera.position.add(` or any `camera.position.*` write path in shake code. **Result at `34d6d98`: PASS — grep finds only documentation comments referencing `camera.position` in the shake context; no code path writes to it from shake.**

## How to tune

This section is the tuning dashboard for Max's "configurable so we can adjust" ask (round-10 Q&A, 2026-04-21). All tunables live at the top of `src/auto/ShipChoreographer.js`. Max edits via F12 during playback review; a hard reload applies the change.

**The loop.** Edit constant → hard-reload Sol tour → trigger shake (debug hook or natural decel on a long leg) → observe → iterate. Use `window._autopilot.debugAccelImpulse()` and `window._autopilot.debugDecelImpulse()` from the browser console to fire deterministic events without waiting for natural triggers.

### Envelope shape

| Constant | V1 | Bounded | Role + felt-experience dial |
|---|---|---|---|
| `TREMOR_ENVELOPE_DURATION` | 1.5 s | [1.0, 2.0] | Total tremor length per event. **Lower (1.0s):** terse, closer to a punch. **Higher (2.0s):** sustained turbulence, reads as the drive sitting in the sharp-motion window longer. Max's ask was "1-2 second shake, subtle"; stay inside that band. |

### Amplitude — how intense the tremor feels

| Constant | V1 | Bounded | Role + felt-experience dial |
|---|---|---|---|
| `TREMOR_PITCH_PEAK_DEG` | 1.0° | [0.3, 2.0] | Peak camera-local X (head-nod) rotation. **Lower:** subtle cockpit twitch. **Higher:** the pilot's head jerks up/down through the window. If tremor reads as "the ship is crashing," lower this. |
| `TREMOR_YAW_PEAK_DEG` | 1.0° | [0.3, 2.0] | Peak camera-local Y (head-shake) rotation. Same dial semantics as pitch. Yaw + pitch together do most of the turbulence-reading. |
| `TREMOR_ROLL_PEAK_DEG` | 0.5° | [0.2, 1.5] | Peak camera-local Z (cockpit-banking) rotation. V1 defaults smaller than pitch/yaw because large roll reads as *the ship tilting*, not *the pilot juddering*. Raise gradually if the tremor feels too "planar." |

### Carrier — how fast the tremor oscillates

| Constant | V1 | Bounded | Role + felt-experience dial |
|---|---|---|---|
| `PITCH_FREQ_HZ` | 20 | [15, 25] | Pitch carrier frequency. **Lower (~15Hz):** slower judder, reads as heavier turbulence / low-altitude buffeting. **Higher (~25Hz):** faster buzz, reads as engine vibration / lighter chop. |
| `YAW_FREQ_HZ` | 22 | [15, 25] | Yaw carrier. Kept ~2Hz off from pitch on purpose — if all three axes match, they synchronize into a Lissajous pattern that reads as mechanical wobble. **Keep a ≥1Hz gap between any two axes.** |
| `ROLL_FREQ_HZ` | 19 | [15, 25] | Roll carrier. Same detuning rule. |

### Trigger — when an event fires

| Constant | V1 | Role + felt-experience dial |
|---|---|---|
| `SIGNAL_ONSET_THRESHOLD` | 35.0 (scene-units/s²) | The `|d|v|/dt|` magnitude that starts a new event. Sol-tour typical sharp-cruise peak is ~180; orbit pitch/breathe noise is ~5–30. **Lower:** shake fires on subtler speed changes (risk: legitimate non-dramatic changes fire — round-9's failure mode). **Higher:** only the sharpest accels/decels fire, shake becomes rare. Tune against telemetry: run a capture, look at `smoothedAbsDSpeed` timeseries, pick a threshold that sits above orbit noise but below sharp-cruise peaks. |
| `SIGNAL_SMOOTHING` | 0.15 | Low-pass α on the raw `|d|v|/dt|`. Lower = slower response / more lag; higher = more jitter-through. 0.15 ≈ 6-frame time constant at 60fps — enough to reject per-frame jitter without lag. Rarely needs changing. |
| `SIGNAL_EVENT_COOLDOWN` | 0.5 s | Minimum silence between same-type events on the same leg. Prevents a single sharp window from firing multiple tremors back-to-back. **Lower:** stutter-fire risk on noisy signals. **Higher:** legitimately-sharp second events on a long leg get suppressed. |

### Common tune-scenarios

- **"Tremor too violent."** Lower `TREMOR_PITCH_PEAK_DEG` + `TREMOR_YAW_PEAK_DEG` in 0.2° steps. Leave `ROLL` alone first — roll contributes the "cockpit" feel. Re-test debug decel (hardest-hitting event).
- **"Tremor too subtle / can't feel it."** Raise all three peaks by 0.2°. If still subtle at 1.5°+, the issue may be carrier-frequency: try lowering all three by 3Hz (slower tremor reads as heavier).
- **"Tremor reads mechanical / pattern-y."** Widen per-axis frequency detuning — make the three frequencies further apart (e.g., 18 / 22 / 26). Lissajous patterns lock when freqs are close or integer-ratioed.
- **"Shake fires when it shouldn't."** Raise `SIGNAL_ONSET_THRESHOLD`. Inspect `window._autopilot.telemetry` `smoothedAbsDSpeed` samples at the offending moment to pick a value above the false trigger but below genuine events.
- **"Shake doesn't fire on a leg that feels sharp."** Lower `SIGNAL_ONSET_THRESHOLD`. Same telemetry loop in reverse.
- **"Accel and decel feel the same."** Check `TREMOR_ACCEL_SHAPE` and `TREMOR_DECEL_SHAPE` constants in the file; the asymmetry is in the envelope curves, not the carrier. If both curves are the same, the envelopes were collapsed — ping PM.
- **"Tremor still plays after the ship is in orbit."** AC #13 / AC #16 guard against this by construction; if it's happening, it's a bug, not a tune. Ping Director.

### Telemetry-driven tuning

`window._autopilot.telemetry.start()` → run a tour → `.stop()` returns per-frame samples. Useful fields for tuning:
- `smoothedAbsDSpeed` — the signal that triggers events. Threshold-tuning reads this directly.
- `shakeActive` + `eventType` + `eventOnsetTime` + `eventDuration` — what fired, when, for how long.
- `shakeEuler` — the per-frame rotation delta. `Math.hypot(pitch, yaw, roll)` gives a scalar "tremor intensity at frame."
- `phase` — so you can verify the event started in `traveling` and aborted on transition.

Three audit helpers re-verify the telemetry-invariant ACs against any capture: `window._autopilot.telemetry.audit.orbitCrossProduct()` / `.signalCoincidence()` / `.envelopeFitsPhase()`. Each returns `{passed: bool, violations: [...]}`.

## Principles that apply

Two of the six in `docs/GAME_BIBLE.md` §11 are load-bearing. Principles 1, 3, 4, 5 are orthogonal to a signal-and-envelope rework inside one module.

- **Principle 2 — No Tack-On Systems.** The anti-pattern this workstream corrects is exactly "shake added for feel." The round-10 redesign derives shake from a real derivative (`|d|v|/dt|`) gated by a real phase predicate (`traveling`), producing a shape the renderer displays — shake is a consequence of a modeled event, not a filter that "activates when something happens." Violation in this workstream would look like: picking an envelope shape because it "feels cinematic" rather than because it reads the ether-friction metaphor, or authoring per-phase-transition shake overrides rather than deriving shake strictly from the signal + phase-gate.

- **Principle 6 — First Principles Over Patches.** Rounds 6–9 accumulated patches on a shape that didn't match Max's ask (continuous bob → log-impulse train → phase-boundary trigger). Round-10 discarded the log-impulse-train surface wholesale and re-derived the tremor shape from Max's aircraft-turbulence reframe. Violation in this workstream would look like: keeping the round-9 envelope arrays and multiplying by a new carrier, or keeping the phase-boundary trigger and adding a signal-guard on top.

## Drift risks

The load-bearing round-10 drift risks (preserved from round-10 amendment; see `## Appendix: Round history` for earlier-round risk history):

- **Risk: Translation contamination — a single `camera.position.add(shake...)` slips in during the FlythroughCamera rework and AC #19 fails.**
  **Why it happens:** "composing shake into the camera" is a single mental operation with two very different code realizations (position vs orientation); off-the-shelf camera-shake code in most engines does translation, and autocomplete favors that path.
  **Guard:** AC #19 is the programmatic check. Working-Claude greps the diff for any `camera.position.` write path introduced in the shake code. Pinned-star pixel check runs as telemetry self-audit. **Passed at `34d6d98`.**

- **Risk: Signal onset-detection fires inside orbit because the phase-gate is implemented as a guard AFTER signal derivation, not as an early return.**
  **Why it happens:** defensive coding order — "derive the signal for telemetry, then check the gate" feels cleaner than "gate first, derive only inside the gate." But a bug in the gate-check could leave signal-derivation sneaking a `_startTremorEvent` call through.
  **Guard:** the onset-detector's entry branch is `if (motionFrame.phase !== 'traveling' || motionFrame.isShortTrip) return;` at the TOP of the function. Signal-derivation runs only inside the gate. AC #16 catches any leak programmatically. **Passed at `34d6d98`.**

- **Risk: Sampling-gate aborts an in-flight event but forgets to reset `shakeEuler` to identity, leaving stale values on the camera.**
  **Why it happens:** "abort event" is one mental operation; "zero the output" is another; code-wise they can be separated.
  **Guard:** the abort path does both in the same code block. AC #13 catches any frame where phase is not `'traveling'` but `shakeEuler.length() > ε`.

- **Risk: Envelope duration hard-coded at 1.5s overflows short `traveling` phases.**
  **Why it happens:** short-but-non-short-hop legs exist (a leg with `dist = 31` is `!isShortTrip` but its `traveling` phase could be <1.5s).
  **Guard:** AC #18 encodes this invariant; the event-starter consults `travelingPhaseRemainingTime` at onset, either shortening to fit or suppressing below the 0.5s floor. **Passed at `34d6d98`.**

- **Risk: Per-axis carrier frequencies synchronize into a visually obvious oval or circle pattern.**
  **Why it happens:** three identical-frequency sines with incidental phase relationships produce Lissajous figures.
  **Guard:** per-axis frequency detuning (pitch 20Hz, yaw 22Hz, roll 19Hz) + random phase offsets at event onset.

## In scope

- **Rework `src/auto/ShipChoreographer.js`** — continuous `|d|v|/dt|` signal derivation + onset-detector gated on `motionFrame.phase === 'traveling' && !motionFrame.isShortTrip` (+ `!motionFrame.warpExit` on accel-side only); atomic `_startTremorEvent(type, onsetTime, duration)`; per-frame sampling emits `shakeEuler = { env(t) × pitch_carrier, env(t) × yaw_carrier, env(t) × roll_carrier }`; abort event on phase transition out of `traveling`.
- **Change public property on `ShipChoreographer`** from `shakeOffset: Vector3` to `shakeEuler: {pitch, yaw, roll}`.
- **Rework `src/FlythroughCamera.js` shake composition** — consumer reads `shakeEuler`, composes onto `camera.quaternion` AFTER `lookAt`, `camera.position` untouched by shake.
- **Retire round-8/9 surface** — `ACCEL_AMPS`, `DECEL_AMPS`, `IMPULSE_INITIAL_GAP`, `IMPULSE_SPACING_RATIO`, `SHAKE_VIEW_ANGLE_MAX` (in its round-8 role), `_shakeOnsetCam2Tgt`, `_shakeOnsetSign`, Gaussian bump machinery, `debugImpulseAtOrbitDistance(c2t, sign)`.
- **Extend `window._autopilot.telemetry`** — new sample fields (`shakeEuler`, `shakeActive`, `smoothedAbsDSpeed`, `eventOnsetTime`, `eventDuration`, `eventType`); three audit helpers (`.audit.orbitCrossProduct()`, `.audit.signalCoincidence()`, `.audit.envelopeFitsPhase()`).
- **Expose tunable constants** at top of `ShipChoreographer.js` (per §"How to tune" above).
- **Debug hooks** `window._autopilot.debugAccelImpulse()` / `.debugDecelImpulse()` — each enqueues a `_startTremorEvent(type)` at the next update tick with the full envelope duration + carrier + peak amplitudes from the tunable constants. Bypass phase/distance gates per scaffolding convention.
- **Recording(s)** at `screenshots/max-recordings/autopilot-shake-redesign-round10-2026-04-21.webm`.
- **Telemetry self-audit BEFORE recording Max sees** — run the three `.audit.*()` helpers + the AC #19 pinned-star pixel check + the AC #19 grep. Iterate on code if any fail.

## Out of scope

- **Retuning envelope constants after initial authoring.** V1 seeds are Max-tunable at review time via `## How to tune`. If the recording shows they need adjustment, that's Max editing constants during review — not a round-11 patch.
- **Porting shake to other camera surfaces.** Only `FlythroughCamera` consumes shake in V1. Free-flight / manual-override cameras are V-later.
- **Audio coupling.** Future autopilot-audio workstreams may subscribe to shake events; shake-as-audio-trigger is V-later.
- **`NavigationSubsystem.js` changes** beyond round-9's `isShortTrip` / `warpExit` MotionFrame fields. Round-10 does not add new MotionFrame fields.
- **New `ShakeEngine` module.** V-later if shake grows additional dimensions (ambient hum, per-system ether-density, per-class-body tuning). Round-10 keeps shake inside `ShipChoreographer`.
- **V-later: Gravity-strength coupling** — larger bodies / deeper gravity wells amplify the shake. Lands cleanly on top of this workstream's foundation.
- **V-later: Per-system ether-density tuning.**
- **Re-recording WS 2's primary Sol tour.** WS 2's existing recording remains valid — ship-axis motion structure is unchanged by this workstream.

## Director actions (follow-up on Shipped flip)

- **`docs/GAME_BIBLE.md` §8H Gravity Drive — tremor-rendering-shape amendment.** LANDED at commit `14e1204`. Canonizes (a) sustained-tremor rendering, (b) asymmetry as envelope curve over carrier, (c) rotation surface.
- **`docs/SYSTEM_CONTRACTS.md` §10.8 Gravity-drive shake invariant — implementation refinement.** Director's call. Not a round-10 gate condition. §8H alone carries round-10 canon; pinning the event-model + rotation-surface in §10.8 would prevent future rendering passes from re-implementing as translation shake.
- **Minor revision of WS 2 brief** (`docs/WORKSTREAMS/autopilot-ship-axis-motion-2026-04-20.md`) §"Parking-lot — shake redesign" paragraph to link forward to this brief as `Shipped`.

## Handoff to working-Claude

The round-10 code is landed at `34d6d98`; this handoff section is preserved for archaeology and for any future iteration (round-11+ if Max's verdict on the recording prompts one). Read order if a follow-up round is needed:

1. Max's verbatim design intent (§"Max's design intent" in `## Appendix: Round history`) — re-read the pebble/boat/ether quote AND the round-10 aircraft-turbulence Q&A answers.
2. `src/auto/ShipChoreographer.js` top-of-file docblock — the round-10 model is documented inline as the canonical source of truth for the tremor surface.
3. `docs/FEATURES/autopilot.md` §"Gravity drives — ship-body shake on abrupt transitions" (lines 194–204).
4. `docs/GAME_BIBLE.md` §8H (as amended, commit `14e1204`).
5. `docs/MAX_RECORDING_PROTOCOL.md` for the recording protocol.
6. This brief's `## Appendix: Round history` for what was tried and why it was retired.

**If a new round opens:** amend this brief with a `## Round-N amendment` section at the bottom of the appendix; do NOT rewrite the promoted current-model sections until the new round is Director-audited and shipped. Workstream retains its brief history append-only.

**If the diff touches `NavigationSubsystem.js` or creates a new module — stop and escalate to PM.** This workstream is a targeted rework; any of those moves is scope drift.

---

## Appendix: Round history

The brief's promoted sections above reflect the **shipped round-10 model**. Rounds 1–9 are archived here with commit pointers for bisect readers; the full prior-round text is available in git history at the commits named.

### Round map

| Round | Commit | Disposition | Summary |
|---|---|---|---|
| 1 (authored) | `cc43c24` | Superseded | Pebble/boat/ether metaphor, single-axis log-impulse train, ACs #1–#7. Translation-surface model. |
| 2 | `deb5056` | Rejected by Max | Round-1 shape implemented; weird wobble arriving at planets + decel wobble firing too early. |
| 3 | `64a7725` | Rejected by Max | Arrival-timing trigger (`approaching → orbiting`) + telemetry recorder added (ACs #8, #9). Scale bugs persisted. |
| 4 | `3031afc` | Rejected by Max | Scale-coupling to orbit-distance at onset, multi-body stress telemetry, moon-arrival recording (ACs #10, #11, #12). Still translation surface. |
| 5 | `04056b9` | Superseded | Sequence boundaries tuned; round-6 silently drifted. |
| 6 | `1636be8` | Rejected | Continuous-sine-bob replaced log-impulse train (silent canon drift). ACs #2 and #4 went to zero in code. |
| 7 | `d02db8f` | Rejected | Amplitude retune on scene-unit + view angle. Scale bugs persisted. |
| 8 | `46ca75e` | Rejected by Max | Path A — restored Bible §8H log-impulse canon on continuous signal. Orbit pitch/breathe/settle fires legitimate non-dramatic speed changes. |
| 9 | `992cbb2` | Rejected by Max | Phase-boundary triggers (`motionStarted` accel, `travelComplete` decel) gated `!isShortTrip`. Dog-with-fleas orbit shake, "car hitting the brakes" at star arrival, planets bouncing (translation surface). |
| **10** | **`34d6d98`** | **`VERIFIED_PENDING_MAX`** | **Rotation-only sustained tremor, signal-gated to `traveling`, belt-and-suspenders sampling gate. Four new telemetry-invariant ACs (#16–#19) all PASS. Awaiting Max's verdict.** |

### Max's design intent (verbatim)

**Round-1 foundational direction (2026-04-21):**

> *"Let's change it from this wobbly in all directions motion that is kind of sick making. It should be more like the motion of a pebble going across a pond or a boat cutting through the waves. In other words, there's only one axis on which the shaking happens. And let's make that shaking motion happen, I'm thinking logarithmically. Imagine the gravity of any given system is kind of like a medium that you're cutting across. Almost like the old ideas of what the ether would be in space. When you cut across it really quickly, by speeding up really fast or decelerating all at once, you get this almost like a friction effect happening. And the size of the waves, so to speak, that you're cutting through that cause this shaking on the one axis should happen in reverse when you're speeding up versus slowing down."*

**Round-3 (arrival timing, telemetry recorder, 2026-04-21):**

> *"This has introduced some weird wobbly stuff happening when we get to the planet. Also, the deceleration wobble is happening way earlier than I would expect... our sci-fi gravity drive deceleration can happen pretty much right when we're arriving at the thing... we need to implement some way of you being able to see the coordinates of what's going on with the camera... so that you can see what's happening."*

**Round-9 (narrative event, not signal filter, 2026-04-21):**

> *"what matters is that this shaking/rumbling should only happen when accelerating or decellerating dramatically. Only then. This will not happen in orbit, only when blasting off from one system object to another, if far enough apart."*

Round-9 Q&A on distance gate:

> *"If we have to travel sufficiently close to the speed of light and accelerate to that speed sufficiently fast (or vice-versa), then there's turbulence."*

Round-9 Q&A on warp exit:

> *"Remain at constant speed when exiting portal, until we slow down to get into the star's orbit."*

**Round-9 → Round-10 reframe (2026-04-21) — ALL THREE bugs + felt-experience reset:**

> *"awful, way off the mark"*

> *"it happens AS THE SHIP DECELERATES OR ACCELERATES SHARPLY. So it wouldn't shake while in orbit around a moon, or right at the point when the trajectory toward the star is almost slowed to a stop. And besides — the overall effect looks comedic, it's like the planets are bouncing around. Is the ship shaking? Because it's should just be a little judder happening in the camera — as if the player is experiencing turbulence, not as if the ship is on a rubber band attached to a zipline."*

**Round-10 Q&A (2026-04-21) — settled duration / shape / axes:**

> *"1. What I want is a 1-2 second shake that's subtle, not all over the place.*
> *2. High-frequency small-amplitude tremor, like aircraft turbulence.*
> *3. Honestly I'm not sure...let's try both from here but make it configurable so we can adjust"*

### Why round-9 telemetry missed the felt-experience failure

The round-9 telemetry asserted that the code did what the round-9 brief said — and it did. What the spec did *not* assert: (a) shake-envelope duration must complete before the next phase transition (round-9 envelope ~1.9s rings out into APPROACHING/ORBITING on small bodies); (b) `shakeOffset > ε` must not overlap any frame where `phase ∈ {'orbiting', 'approaching'}` (the round-9 test sampled these independently, never crossed them); (c) shake must coincide with sharp-motion signal, not fire AFTER it (Hermite-ease `|d|v|/dt|` peaks mid-segment at `t ∈ [0.3, 0.7]`, not at `t=1` where `travelComplete` fired round-9's decel); (d) surface must be rotation not translation (a 2.86° view-angle offset applied as world-Y position shifts every framed object — reads as rubber-band, not judder). Round-10 encodes all four as telemetry-invariant ACs (#16–#19) that run programmatically against a capture.

### What round-10 retired from rounds 8/9 (verbatim, for bisect readers)

- `ACCEL_AMPS = [0.30, 1.00, 0.70, 0.35, 0.10]` — dead. Crescendo-fade now lives as a continuous amplitude envelope over the tremor carrier.
- `DECEL_AMPS = [1.00, 0.55, 0.30, 0.17]` — dead.
- `IMPULSE_INITIAL_GAP = 0.08`, `IMPULSE_SPACING_RATIO = 1.8` — dead.
- Gaussian bump per bounce — dead. Replaced by sinusoidal carriers.
- `SHAKE_VIEW_ANGLE_MAX = 0.05` as peak impulse-view-angle — dead in that role.
- `_shakeOnsetCam2Tgt` — dead. Rotational shake doesn't need a distance scale.
- `_shakeOnsetSign` — dead. Signed signal directly shapes the envelope.
- `shakeOffset` Vector3 position-offset API — retired. New API is `shakeEuler`.

### Round-level drift notes (audit-trail)

**Rounds 2–4.** Rounds 2–4 iterated on round-1's translation-surface log-impulse model. The scale bug (round-4) exposed a 666× orbit-distance spread producing view-flipping lurches at moons and minor nudges at stars. The scale-coupling fix (round-4 AC #10) was a band-aid on the wrong surface; rotation (round-10) retires the scale problem structurally.

**Rounds 5–7.** Canon drift from log-impulse-train to continuous-bob — round-6 silently replaced the envelope without Director audit; round-7 retuned the scene-unit amplitude. Max's round-5 feedback was read as "shape is wrong, try a continuous thing" when it should have been escalated as a Director audit (the envelope shape IS canon per §8H).

**Round 8.** Path A — restored log-impulse train on continuous signal. Passed telemetry ACs but fired on legitimate non-dramatic speed changes (orbit pitch oscillation, breathing).

**Round 9.** Replaced continuous signal with phase-boundary triggers. Passed telemetry ACs; failed Max's felt experience in three concrete ways (orbit shake, brake-at-star shake, planets-bouncing visuals). Telemetry-as-spec was insufficient — specs were behavioral (*events fire on phase transitions*) not experiential (*events coincide with sharp motion*).

**Round 10.** Structural reset on all four failure-class vectors: (1) signal-driven trigger (fires during sharp motion, not at boundaries that end it); (2) phase-gated at trigger AND sampling (orbit silence architectural); (3) rotation-only surface (planets stay put); (4) telemetry-invariant ACs (#16–#19) encode the experiential contract programmatically.

### Revision history

- **2026-04-21 — authored** by PM from Max's pebble/boat/ether design direction (commit `cc43c24`).
- **2026-04-21 — Rounds 2–4 amendments** by PM after successive recording rejections (commits `60aeca2`, `2dc561f` / `ddbacf9`, `038d6a6`). Added ACs #8–#12 for arrival timing, telemetry recorder, scale-coupling, multi-body stress-test, moon-arrival recording.
- **2026-04-21 — Round 8 pivot amendment** (commit `755000e`). Path A — restore Bible §8H log-impulse canon on continuous signal; rounds 6–7's continuous-bob reverted.
- **2026-04-21 — Round 9 pivot amendment** (commit `d710700`). Phase-boundary triggers gated on `!isShortTrip` with warp-exit accel carve-out. ACs #13, #14, #15 added for orbit-silence, short-hop-silence, warp-exit asymmetry.
- **2026-04-21 — Round 10 pivot amendment** (commit `27458d1`). Rotation-only sustained tremor, signal-gated to `traveling`, belt-and-suspenders sampling gate. ACs #16–#19 added as telemetry-invariant closes for the round-9 spec-class gap. Bible §8H amended in parallel (commit `14e1204`).
- **2026-04-21 — Round 10 Status flip** to `VERIFIED_PENDING_MAX 34d6d98` (commit `6f2a4e7`) after working-Claude self-audit confirmed all four telemetry ACs PASS programmatically.
- **2026-04-21 — Brief hygiene pass** by PM: promoted round-10 model + final ACs to top; collapsed rounds 1–9 into this appendix with commit pointers; added `## How to tune` dashboard section per Max's "configurable so we can adjust" ask.
