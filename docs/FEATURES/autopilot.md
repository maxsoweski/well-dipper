---
status: ACTIVE — created 2026-04-20 by Director from completed heart's-desire → V1 interview with Max
captured: 2026-04-20
captured_by: Director (via working-Claude conducting the interview), then Director-authored
related_bible: docs/GAME_BIBLE.md §1 Vision / Core Experience, §8H Propulsion & Travel Landscape (gravity drives), §2 Aesthetic
related_research: docs/RESEARCH_transit-propulsion.md §2.5 Gravity Drives / Inertialess Drives
related_contracts: docs/SYSTEM_CONTRACTS.md §5 Camera and Control, §Autopilot (bootstrapped in same Director pass)
related_catalog: docs/OBJECTS_OF_INTEREST.md (v0, 2026-04-20 — source-of-truth for valid tour subjects / showcase targets / rove candidates)
---

# Autopilot

## Revision history

- **2026-04-26 — `lhokon` cubic-out tuning lock-in (§A6 amendment).** Felt-experience tuning lock-in for the §A5 lhokon phase, after Tester PASS at HEAD `27cc9f4` (§T3) failed to surface a felt miss Max watched in the Sol-tour recording: arrivals (jumpscare → STATION-A) felt right, departures didn't read as "camera centered on target before ship burns." Live trace at `27cc9f4` confirmed lhokon was firing and the math passed (camera direction reached new-target direction at lhokon→CRUISE boundary within FP precision). The miss was tuning calibration: at `dot threshold = 0.9999` the camera was ~15 px off-center when CRUISE began — under the AC bound but visibly "almost." The `autopilot-lab.html` harness landed at `3ced806` to expose the three lhokon tunables (`lhokonDotThreshold`, `lhokonTimeoutSec`, `lhokonEaseFn`) as live-mutatable instance properties. Max evaluated empirically and selected the production triple: **`lhokonDotThreshold = 0.999999`** (six 9s, ≈ 0.08° angular error / sub-pixel at 1280×722, 70° FOV) + **`lhokonTimeoutSec = 3.0`** (cubic-out's terminal landing needs the duration; timeout becomes the de-facto end-of-curve marker rather than a degenerate-geometry backstop) + **`lhokonEaseFn = cubic ease-out`** (`1 − (1−t)³`). Cubic-out replaced the §A5 default smoothstep because smoothstep's slope-0 terminal asymptotes — the camera creeps into the last fraction of a degree, producing the "almost-centered" felt-miss. Cubic-out lands firmly (slope-0 at t=1). The trade-off is cubic-out's slope-3 at t=0 — a designed first-frame impulse Max judged acceptable after lab evaluation. AC #14 entry-frame bound carved out under §A6 framing (b): the bound applies frame 2 onward; frame 1 is by-design discontinuous. Quintic smoothstep was tested as an alternative and ruled out by Max's verbatim observation: *"When the bodies are orbiting, the quintic even sometimes reads as a bit too fast."* Quintic's softer tail can't catch a moving target before CRUISE; cubic-out's firmer landing is robust to orbital motion. The lab harness is the verification artifact for §A6's empirical claims.

- **2026-04-25 — `lhokon` phase introduction (§A5 amendment).** Resolves the structural conflict Tester verdict §T1 surfaced between in-CRUISE smoothing and AC #5a's per-frame body-tracking bound (`docs/WORKSTREAMS/autopilot-camera-ship-decoupling-2026-04-25.md` §"Amendments — 2026-04-25 (lhokon phase introduction)"). Adds a named phase, **`lhokon`**, between `STATION-A` and `CRUISE`. lhokon is the **camera-convergence beat**: the ship is anchored at the STATION-A position with `|ship.velocity| ≈ 0`; the camera rotates from the old-target-direction toward the new-target-direction; CRUISE begins only after the camera is centered on the new target. CRUISE-entry gate is **dot-gate primary** (`dot(camera_forward, normalize(new_target.current_position − camera.position)) ≥ 0.9999`) **with a fixed-duration timeout fallback** (1.5 s) — option (c) in the workstream amendment. Drift Risk #5's prior failure shape ("camera lingers on a receding subject after leg-swap") becomes structurally impossible: the ship is not yet moving toward the new target during lhokon, so there is no receding subject. AC #5a narrows to `{ENTRY, CRUISE, APPROACH, STATION-A}` (lhokon excluded by carve-out); ACs #11 (lhokon onset), #12 (lhokon completion gates CRUISE entry), #13 (ship stationary during lhokon), #14 (smoothness preserved at lhokon entry/exit) are added. Implementation: `AutopilotMotion` is now the single source of truth for camera authored direction (`motionFrame.cameraLookDir`); `CameraChoreographer` reads it directly. The 1.5 s direction-nlerp from the prior in-CRUISE smoothing migrates into `_tickLhokon` rather than being reverted wholesale — same mechanism, correct phase site.

- **2026-04-25 — Camera/ship axis decoupling re-scope (§A4 amendment).** Director audit §A4 at `~/.claude/state/dev-collab/audits/autopilot-station-hold-redesign-2026-04-24.md` reverses the 2026-04-24 collapse of V1 camera-axis to "look down ship-forward + shake." Camera and ship are now genuinely independent on V1: **camera axis = pursuit-curve on autopilot target body** (every frame, `lookAt(target.current_position)`); **ship axis = predicted-intercept** (closed-form quadratic solver re-aiming `ship.forward` each frame at where the body will be when the ship arrives, given current body velocity + cruise speed). The 2026-04-24 §CRUISE *"aim-once-at-intercept, fly straight"* rule (Max Q3 reasoning: *"unless we're playing at unrealistically exaggerated speeds... that should never really be required, but still, let's just do it on principle, B."*) is reversed — the §A4 audit found that aim-once produces visible camera mis-framing of moving bodies under realistic CRUISE durations, and that ship-axis re-aim is the correct fix once camera-axis is no longer reading ship.forward for its lookAt direction. AC #5 invalidated and split into AC #5a (camera tracks body) + AC #5b (ship aims at predicted intercept). AC #1 redrawn as a hit-the-target tolerance bound, no longer a straight-line-path bound. AC #7 preserved — ship orientation is still authored (autopilot writes `ship.forward` each frame, just to a different value: predicted-intercept direction, not aim-once direction); shake still reads `ship.forward` and `ship.up` for its perturbation axis. Camera no longer reads `ship.forward` for the lookAt direction. The two-axis architecture is preserved and *more* independent under §A4 than under the 2026-04-24 reframe.

- **2026-04-24 — V1 motion-model reframe to STATION-hold (this amendment).** Director-run interview with Max (script + verbatim answers recorded in `~/.claude/state/dev-collab/audits/autopilot-live-feedback-2026-04-24.md` §"Feature-Doc Amendment Interview Script (Max)", lines 1515–1694; answers appended post-interview). The (α) stub at `screenshots/max-recordings/stub-saturn-v4-2026-04-24.fixed.webm` is the felt referent. Change set is structural, not a tune: §Ship axis V1 collapses to CRUISE → DECEL → HOLD; §Camera axis V1 collapses to "camera looks down the ship's forward vector plus shake on top" — linger, pan-ahead, and the composed-with-ship-arc `ESTABLISHING` accent are demoted to V-later with no authored shape. `STATION` bifurcates into `STATION-A` (V1 hold) and `STATION-B` (V-later opt-in orbit); the prior "`STATION` is stationary" failure line flips into V1 spec. A new precondition surfaces: ship model requires a defined front/back/top/bottom orientation because the V1 camera reads ship-forward. Q11 ("most-interesting-first") unchanged; stays V-later behind OOI registry. Q10 (V-later orbit shape) deferred to the ORBIT-mode scoping pass. See §V-later carve for what was moved there.

## One-sentence feature

Autopilot is the game's **cinematic tour mode**: the ship flies itself through each system with purpose and elegance while the camera — the player's eyes — takes in the system independently, showing the player the most interesting things in their immediate environment, different every trip.

## Heart's desire

Wonder and interest. Like a human navigator + cinematographer taking viewers on a tour of the galaxy, showing the most interesting things in their immediate environment. The ship moves with purpose and elegance; the camera moves in 360° independently of the ship, looking at nearby stars, galactic features (nebulas in the starfield), the disk of the galaxy, planets and their details, moons, planet-moon relationships, planet-star relationships, light playing across surfaces, crescents and eclipses at interesting angles.

**Register:** 60s/70s space cinematography. Elite Dangerous autopilot vibe as a nearby reference. "Blue Danube" over 2001's station-docking sequence as the touchstone — not to imitate, but to match the sense of *ship as a body moving through a composed frame*, set against a world indifferent to the drama.

## Source

- Max + Director interview, 2026-04-20 (heart's desire articulation → phase structure → V1/V2 triage → felt walkthrough).
- `docs/GAME_BIBLE.md` §1 Core Experience — *"Every system is different. Finding a terrestrial world or an alien megastructure is rare and meaningful."* Autopilot is the vehicle that delivers the "rare and meaningful" felt moment.
- `docs/GAME_BIBLE.md` §8H Propulsion & Travel Landscape — the ship's pre-collapse exotic drive is the in-fiction permission for cinematic flight.
- `docs/RESEARCH_transit-propulsion.md` §2.5 — research-stage treatment of gravity drives, folded into the Bible in the same Director pass that authored this doc.
- `docs/OBJECTS_OF_INTEREST.md` — catalog of what autopilot can point at.

## Two-axis phase structure

Autopilot's phase model is **two orthogonal taxonomies** that compose per-moment. This replaces today's single-axis state machine (`FlythroughCamera.State = { DESCEND, ORBIT, TRAVEL, APPROACH }` at `src/auto/FlythroughCamera.js:26`), which conflated ship-holding and camera-framing into a single `ORBIT` state and made growth impossible without rewrite.

**Ship axis** (5 phases — where is the ship, what is it doing):

| Phase | Was | Means |
|---|---|---|
| `ENTRY` | renamed from `DESCEND` | Arrive along the warp-exit vector. Today's DESCEND assumes "from above" — wrong. Start pose is **derived from the warp-exit forward direction**, not from a fixed above-the-plane origin. |
| `CRUISE` | renamed from `TRAVEL` | Sustained travel between bodies at high fraction-of-c speeds. Elegant, purposeful, unhurried by default. |
| `APPROACH` | kept | Deceleration + attitude change as the target body's reticle/billboard expands into a real disk. |
| `STATION-A` | retired `ORBIT` (V1) | **Held position** near a body. Ship comes to rest close enough that the body fills the frame (~60% of screen, felt-fill). No orbital motion. Held until the next mode activates — manually or automatically. |
| `lhokon` | new (§A5 2026-04-25) | **Camera-convergence beat** between `STATION-A` and the next leg's `CRUISE`. Ship anchored at the STATION-A position; camera rotates from old-target-direction toward new-target-direction; CRUISE begins only after the camera is centered on the new target (dot-gate ≥ 0.9999, with 1.5 s timeout fallback). |
| `STATION-B` | V-later | **Opt-in orbital motion** around a held body. Engaged from `STATION-A`. Shape (speed ratio, framing rule, entry/exit discipline) scoped in the future ORBIT-mode workstream, not authored here. |

**Camera axis** (3 modes — what are the player's eyes doing, orthogonal to ship axis):

| Mode | V1? | Means |
|---|---|---|
| `ESTABLISHING` | **V1** | Wide, slow, takes in the whole frame. The Blue Danube opener. Follows ship phases but paces itself independently — can linger on a receding STATION subject as the ship begins CRUISE, then pan forward to the next target. |
| `SHOWCASE` | V-later | The cinematographer beat. Framed shots of crescent, eclipse, ring-shadow, moon transit, light on terrain. Queries `docs/OBJECTS_OF_INTEREST.md` §5 Light & composition. |
| `ROVING` | V-later | Player-eye freedom, 360°, curious. "Turn head" toward nearby objects of interest. Queries `docs/OBJECTS_OF_INTEREST.md` §1–§6. |

**Taxonomies compose.** Camera mode is selected per-moment, not per-ship-phase. `STATION-A + SHOWCASE` (V-later) = eclipse framing on a held body. `CRUISE + ROVING` (V-later) = looking out the window en route. `ENTRY + ESTABLISHING` = arrival reveal. V1 only exercises `ESTABLISHING` on the camera axis, and V1's `ESTABLISHING` is deliberately thin (see §Per-phase criterion — camera axis (V1) below).

**`ORBIT` is retired.** The current conflated state is rewritten by this feature. `STATION-A` / `STATION-B` live on the ship axis; `SHOWCASE` lives on the camera axis; the old fusion of the two is gone. Any new code that reintroduces a single combined "orbit-and-frame" state is a regression against this structure.

## Per-phase criteria — ship axis

These are felt-experience criteria, not acceptance criteria. Workstream ACs cite back to them.

### `ENTRY` — arrival

- Velocity coming out of warp is **preserved as a continuity anchor** — no snap-to-zero on exit, no pop-to-a-new-velocity. The warp handoff feels like one motion.
- Gradual acceleration toward the system's main attractor. Not flip-and-burn; a slow bend in the trajectory.
- Holds **safe distance** — the ship can't get too close to a star/binary. This is where the star-orbit-distance workstream (`docs/WORKSTREAMS/autopilot-star-orbit-distance-2026-04-20.md`, commit `3733029`) lands: the post-warp arrival orbit should read as "a long respectful look at a stellar body," not "skimming the photosphere."
- Ends in `STATION` around the central attractor.
- Picks the first planet (see §First-planet selection).
- Elegantly initiates `CRUISE` — the transition is a camera + choreography moment, not a hard cut.

### `CRUISE` — sustained travel

- **Predicted-intercept re-aim each frame** (§A4 amendment 2026-04-25 — see §Revision history). Each frame, the ship re-aims `ship.forward` at the predicted intercept point — *where the target body will be when the ship arrives*, given current body velocity and cruise speed. The 2026-04-24 *"aim-once-at-intercept, fly straight"* rule is reversed by §A4. Max's Q3 reasoning (*"unless we're playing at unrealistically exaggerated speeds... that should never really be required"*) is preserved in this revision history entry as the honest record of why the spec changed: the §A4 audit found that aim-once produces visible camera mis-framing of moving bodies during realistic CRUISE legs, and the correct fix is ship-axis re-aim now that camera-axis is decoupled from ship.forward (see §"Per-phase criterion — camera axis (V1)" §ESTABLISHING below).
- **Closed-form quadratic solver** for the predicted intercept point. Solve for time-to-arrival `t`:
  ```
  |R + V·t|² = (s·t)²
  (V·V - s²)·t² + 2(R·V)·t + R·R = 0
  where R = body.position - ship.position
        V = body.velocity
        s = cruiseSpeed (ship's scalar cruise velocity)
  ```
  Pick the smaller positive root. The intercept point is `body.position + V·t`; aim `ship.forward` at it.
- **Solver edge case — graceful fallback.** If the quadratic discriminant is negative, the ship cannot intercept at the current cruise speed (body is moving away faster than the ship can close). Fallback: re-aim `ship.forward` at `body.current_position` (the aim-at-current-position degenerate case). This is also surfaced in §"Failure criteria" as a flag if it fires under realistic playable conditions.
- Picks up to **relativistic speeds** toward the target (see Open questions: literal-or-felt).
- Target's reticle/billboard is still ahead in the frame for most of the phase; the handoff to `DECEL` (see next phase) is the moment it starts resolving into real geometry.
- **ACCEL shake at CRUISE onset.** Gravity-drive shake fires at the start of CRUISE (departure), as a pure reverse of the DECEL shake (see §Gravity drives + §Per-phase criteria — `DECEL` below). No shake *during* cruise — only at the onset boundary.
- **Entry continuity (STATION-A → CRUISE) — V1.** The ship leaves the hold with an acceleration onset, not a snap to cruise velocity. The ACCEL shake boundary marks the drive pushing the ship out of the held frame.

### `APPROACH` — aggressive deceleration at fixed range

- **Onset rule: fixed distance from the body.** APPROACH begins when the ship reaches **10× the body's radius** (V1 starting value — tunable during lab iteration, not expected to vary at shipping). No ramp, no gradual; CRUISE → APPROACH is a hard velocity onset at the 10R threshold.
- **DECEL shake fires at the onset.** The gravity-drive-over-envelope tell (see §Gravity drives). Pure forward image of the CRUISE-onset ACCEL shake.
- **Aggressive deceleration, not progressive.** The drive is being pushed past its envelope on purpose — that's why the shake fires. The ship scrubs velocity hard over a short interval.
- **The reticle→disk transition is load-bearing.** The moment the target stops being a billboard and becomes a real 3D body is itself part of the felt experience — not a technical detail. LOD handoff timing is a phase criterion, not a rendering implementation detail to hide.
- **Jumpscare arrival.** Max's verbatim V1 acceptance felt-criterion for the APPROACH → STATION-A transition (2026-04-24): *"You are zooming straight towards the planet or the moon, whatever it is. It gets closer and closer to you and right where it feels like you're about to slam into it and blow up. The camera shakes and you decelerate extremely quickly, such that it's almost like it jumpscares, like it jumps up into your vision. And then you're just hanging there in front of the planet. It looms huge in front of you. And you just stay there. You stay stationary until the next mode activates, either manually or automatically."* This is the shape of the transition. Implementations that read as a gentle glide-in are failing the V1 spec.

### `STATION-A` — held position (V1)

- **Stationary, by design.** The ship has come to rest at the end of APPROACH and remains at rest for the duration of `STATION-A`. This is the V1 spec; the prior "orbit, not stationary" authored criterion is superseded by this amendment (see §Revision history 2026-04-24).
- **Felt-fill framing, not numeric ratio.** The body fills **~60% of the screen** at hold. Max's reasoning: numeric distance ratios scale wrong for small bodies (moons especially) — felt-fill is what the tour actually wants. This resolves the prior-attempt complaint about hold distance "never feeling close enough to moons."
- **Body looms huge in frame.** The held pose is immersive. Planet / moon is "ground"; the starfield is "sky."
- **Held until the next mode activates.** Either manually (player input) or automatically (autopilot advances to the next tour subject). The hold has no timer authored here.
- **Camera is pointed at the body's surface** (inherited from APPROACH's final aim; `ESTABLISHING` camera mode does not re-orient during the hold in V1).
- **Entry continuity (APPROACH → STATION-A).** The ship decelerates to zero; velocity continuity is trivially satisfied (terminal velocity = 0). The shake that fires at APPROACH onset is the marker of the high d|v|/dt, not a continuity violation.

### `lhokon` — camera-convergence beat (V1, §A5 2026-04-25)

- **Inserted between `STATION-A` and the next leg's `CRUISE`.** When the auto-advance timer at the end of `STATION-A` fires and the next tour subject is selected, the ship does **not** immediately begin to burn. It enters `lhokon`: the ship is anchored in world space at the STATION-A position with `|ship.velocity| ≈ 0`, and the camera rotates from the direction it was pointing on the last STATION-A frame (toward the old subject) to the direction toward the new subject's current position. CRUISE begins only after the camera has converged.
- **Why it exists.** Without this phase, the swap-and-pivot happens during CRUISE, which violated the per-frame body-tracking bound (`camera.lookAt(target.current_position)` every CRUISE frame) — Tester verdict §T1 caught this in commits `dc26cbd`/`70c4b09`/`8f6623d`. Moving the smoothing to a phase where the ship is stationary preserves both: the smoothness is authored deliberately, and AC #5a's strict per-frame bound passes by construction during CRUISE because the camera is converged before CRUISE starts.
- **Why "linger on a receding subject" is structurally impossible during lhokon.** The ship is not yet moving toward the new target. The old subject is not receding. There is no receding subject for the camera to linger on. The Drift Risk #5 failure shape that motivated the strict per-frame bound in the §A4 amendment is dissolved by the lhokon design — not relaxed.
- **CRUISE-entry gate — dot-gate primary, fixed-duration timeout fallback.** lhokon completes when `dot(camera_forward, normalize(new_target.current_position − camera.position)) ≥ 0.999999`, OR when 3.0 s has elapsed (whichever fires first). Values updated under §A6 2026-04-26 from the §A5 defaults (`0.9999` / `1.5 s`) after Max's lab evaluation surfaced that `0.9999` produced a "centered enough for the math, almost-centered to the eye" felt-miss. The dot-gate is still the conceptual exit; with cubic-out's slope-0 terminal, the dot reaches `0.999999` very late in the curve and timeout often becomes the de-facto end-of-curve marker. Timeout firing under §A6 is **not** a degenerate-geometry flag — it's normal cubic-out tail behavior. (V-later orbit-mode evaluation should re-examine whether the timeout-as-end-of-curve coupling needs re-scoping.)
- **Smoothing curve.** Cubic ease-out on lerp progress (`1 − (1−t)³`) — §A6 2026-04-26 production default, replacing the §A5 smoothstep. Cubic-out lands firmly at t=1 (slope-0 at the terminal — satisfies AC #14 exit `≤ 0.5°`); the trade-off is slope-3 at t=0, a designed first-frame angular impulse (~1.5° on a typical 90° swap) that Max judged acceptable in the lab. AC #14 entry-frame is carved out under §A6 framing (b); the bound applies frame 2 onward. Normalized lerp from start direction to end direction; end direction is re-derived each frame to track an orbiting new body.
- **Entry continuity (`STATION-A → lhokon`).** lhokon's first frame begins the rotation from the camera's last-held STATION-A pose with continuous angular velocity. AC #14 enforces `angularDelta_lhokon_entry ≤ 0.5°`.
- **Exit continuity (`lhokon → CRUISE`).** lhokon's last frame is at or near the new pursuit-curve direction; CRUISE's first frame is on the pursuit-curve direction. AC #14 enforces `angularDelta_lhokon_exit ≤ 0.5°`.
- **Ship orientation during lhokon.** Autopilot still writes `ship.forward` each frame (anchored to the cruise direction it computed at lhokon onset), so the shake module's accessor surface is preserved (consumer set unchanged from §A4: `{shake}` only).
- **Initial leg has no lhokon.** `lhokon` only fires for inter-leg swaps. The first leg (post-warp `ENTRY` or fresh tour start with `_target` previously null) goes straight from `IDLE` to `CRUISE` — there is no old-target-direction to converge from.

### `STATION-B` — opt-in orbital motion (V-later)

Engaged from `STATION-A` by explicit action (player opt-in, or — future question — automatic advance after a beat). Orbital shape, speed ratio, tight-orbit framing rule, and the transition discipline from `STATION-A` to `STATION-B` and back are **not authored here**. Scoped in the future ORBIT-mode workstream. Q10 in the 2026-04-24 interview deferred this deliberately.

### First-planet selection

Current code (`AutoNavigator.buildQueue`) visits inner-to-outer. Director's note inline at §Open questions — the "most interesting first" rule likely reads better than monotonic distance order, but it introduces a dependency on OOI-registry runtime queries that don't exist in V1. V1 stays on inner-to-outer; V-later reconsiders when the OOI registry is live.

## Per-phase criterion — camera axis (V1)

### `ESTABLISHING` — camera tracks autopilot target body (V1, §A4 redesign)

**§A4 redesign (2026-04-25).** V1 `ESTABLISHING` no longer reads `ship.forward` for its lookAt direction. The camera follows a **pursuit curve on the autopilot target body**: every frame, `camera.lookAt(target.current_position)`. This applies across the full leg — `ENTRY`, `CRUISE`, and `APPROACH` — and persists into `STATION-A` where the held pose is naturally body-centered. Shake stays additive on top of the body-tracking lookAt.

V1 camera axis:

- **Looks at the autopilot target body each frame.** `camera.lookAt(target.current_position)` is the authored compositional rule. Target body's CURRENT position, not a captured-at-onset snapshot, not the ship's forward vector.
- **Receives shake on top** (additive perturbation). ACCEL shake at CRUISE onset, DECEL shake at APPROACH onset. The body-tracking lookAt is the base; the shake is layered on top — the body remains framed during the shake event.
- **Does NOT linger on a receding subject** (the body the ship is *leaving*). The camera tracks the *next* target as soon as the leg starts. V-later authoring may add a brief linger on the receding subject before re-targeting; V1 does not.
- **Does NOT pan forward toward an incoming target before the leg starts.** V-later.
- **Does NOT author a departure arc** off the held subject as `STATION-A` releases. V-later.
- **Does NOT rove 90° off-path.** That's `ROVING` (V-later, unchanged).
- **Does NOT zoom to a specific compositional beat.** That's `SHOWCASE` (V-later, unchanged).

**The V-later carve is preserved by §A4.** The redesign does not re-import linger / pan-ahead / departure-arc authoring into V1 — it changes what V1's *minimum* is. V1's minimum is now "track the autopilot target body" rather than "look down ship-forward." Both are thin authoring; §A4 swaps the compositional anchor from ship-forward to body-current-position.

**Two-axis architecture stays — and is more independent under §A4.** Under the 2026-04-24 reframe, camera-axis read ship-axis (ship.forward) — a coupling. Under §A4, camera-axis reads target-body-position directly; ship-axis writes `ship.forward` for the predicted intercept (read by shake for its perturbation axis, not by camera for its lookAt). The `CameraMode` dispatch (§V1 architectural affordances) still ships; V-later `SHOWCASE` / `ROVING` / richer `ESTABLISHING` graft on without rewrite.

### Precondition — ship orientation is still load-bearing (rationale updated by §A4)

Ship orientation remains an authored property of the ship object. The ship model has a **defined front/back/top/bottom orientation** in the scene graph. The orientation does not have to be visible to the player (no chevrons, no decals required), but it must exist as an authored property of the ship object, not derived per-frame from motion direction.

**§A4 update (2026-04-25):** the **camera no longer reads ship.forward** for its lookAt direction. The precondition is preserved because the **shake mechanism** still reads `ship.forward` and `ship.up` to author its perturbation axis (camera/ship-mesh additive perturbation, anchored to the ship's body frame). Under §A4, the autopilot still writes `ship.forward` each frame — to the predicted-intercept direction (§CRUISE) — and the ship holds the written orientation through `STATION-A`'s rest; shake reads it. The accessor surface (`forward`/`up`) is unchanged from the 2026-04-24 contract; only the consumer set narrows (camera dropped, shake retained).

## V1 / V-later triage

### V1 — must ship

- **All 4 ship phases** (`ENTRY`, `CRUISE`, `APPROACH`, `STATION-A`) — ship motion is greenfield; it doesn't exist today.
- **Warp-exit-vector arrival pose** — `ENTRY` start is derived from the warp forward direction, not a fixed above-the-plane origin.
- **CRUISE: predicted-intercept re-aim** (per §A4 amendment 2026-04-25 — see §Revision history; reverses the 2026-04-24 Q3 aim-once rule). Closed-form quadratic solver (see §CRUISE ship-axis above); aim `ship.forward` each frame at the predicted intercept point. Graceful fallback if discriminant < 0.
- **APPROACH onset at 10× body radius** (fixed-distance rule; starting value tunable in lab, not expected to vary at ship).
- **Aggressive decel + jumpscare arrival.** The APPROACH → STATION-A transition satisfies Max's verbatim felt-criterion quoted in §Per-phase criteria — `APPROACH`.
- **STATION-A = held position, felt-fill ~60% of screen.** The body looms huge; no orbital motion; ship stays at rest until next mode activates.
- **Ship orientation defined in the model** (new 2026-04-24 precondition — see §Per-phase criterion — camera axis (V1) §Precondition).
- **Ship/camera decoupling architecture** — the two-axis structure must be in place at V1 even though only `ESTABLISHING` is exercised on the camera axis and V1's `ESTABLISHING` authors almost nothing.
- **`ESTABLISHING` camera mode (V1 shape, §A4 redesign 2026-04-25)** — camera tracks autopilot target body each frame (`camera.lookAt(target.current_position)`); receives shake on top. Linger, pan-ahead, and departure arc remain V-later. The 2026-04-24 "look down ship-forward + shake" V1 rule is reversed by §A4 (see §Revision history).
- **Gravity-drive shake at both phase boundaries.** ACCEL shake at CRUISE onset (departure). DECEL shake at APPROACH onset (10R threshold). Pure reverse of each other per Q5. No shake during smooth phases.
- **Toggle UI** — status indicator upper-left + keybinding (`Tab`, **provisional** — see §Keybinding below).
- **Default-ON state** — autopilot is the default, not opt-in.
- **Manual override with inertial continuity** — toggling off preserves angular momentum; no snap-stop.
- **HUD hide-during-autopilot / reappear-on-interaction.**
- **Audio event-surface hook** — future BGM layer can subscribe to autopilot-state changes. The hook ships in V1; the modulation doesn't.
- **Star-orbit safe-distance rule** — the star-orbit-distance workstream lands against this criterion (applies to `ENTRY`'s `STATION-A` around the central attractor).

### V-later — polish, must graft on without architectural rewrite

- **`STATION-B` opt-in orbital motion.** Speed ratio, tight-orbit framing, entry/exit discipline — authored in the ORBIT-mode workstream. The player-opt-in-vs-auto-advance question (whether V1-plus-one auto-transitions `STATION-A → STATION-B` after a beat, or requires explicit input) is deferred to that same workstream.
- **Richer `ESTABLISHING` authoring.** Linger on a receding subject as the ship begins the next phase. Pan forward toward an incoming target ahead of arrival. Departure arc from `STATION-A` into `CRUISE`. The current V1 "looks down ship-forward + shake" minimum is the architectural placeholder; the authored camera moves graft on top of the same `CameraMode` dispatch.
- **CRUISE per-frame re-aim from drift.** Not authored for V1 (Q3 decision: fly straight from one-time aim). Revisit only if playtesting surfaces a felt gap on unrealistically long / drift-sensitive legs.
- `SHOWCASE` camera mode (framed compositional beats — crescent, eclipse, ring-shadow, transit).
- `ROVING` camera mode (player-eye freedom, 360° turn-head-toward-OOI).
- OOI runtime registry (the query substrate `SHOWCASE` and `ROVING` consume at runtime — workstream at `docs/WORKSTREAMS/ooi-capture-and-exposure-system-2026-04-20.md`).
- Proactive OOI geometric-beat detectors (eclipse-upcoming, ring-plane crossing, moon-transit).
- Actual autopilot→BGM integration (V1 ships the event-surface hook; V-later subscribes the music layer to it).
- "Most interesting first" planet selection (replaces inner-to-outer queue). Q11 (2026-04-24) unchanged from prior triage — stays V-later behind OOI registry.

### V1 architectural affordances for V-later items

Each V-later item requires a specific extension hook **built into V1** even if not exercised. The Director will flag any V1 design decision that forecloses a V-later path.

- **`SHOWCASE` / `ROVING` camera modes** → the camera-axis code path must be a **first-class selector**, not an if-branch inside `ESTABLISHING`. V1 implements a `CameraMode` enum (`ESTABLISHING` / `SHOWCASE` / `ROVING`) even if only one value is ever selected, and routes camera updates through a dispatch that can accept any of the three. Adding `SHOWCASE` later is a new branch, not a restructure.
- **OOI runtime registry** → the camera update loop queries *through* a lookup interface (stub in V1), not directly from scene globals. V1 interface returns `null` / empty for `getNearbyOOIs()` and `getActiveEvents()`; V-later implementation lights those up without changing the caller.
- **Actual BGM modulation** → audio event-surface emits autopilot-state transitions as events. V1 emits them; V1 has zero subscribers. V-later audio layer subscribes.
- **"Most interesting first" planet selection** → `AutoNavigator.buildQueue` takes a `selector` function (V1: monotonic-distance default). V-later supplies an OOI-weighted selector.

## Trigger / toggle / UI (V1)

- **Default state:** ON. Autopilot is the default mode from system-load, not opt-in.
- **Toggle off:** clickable **status indicator in upper-left of screen** OR a keybinding. The indicator is a small element, clickable, integrates with the existing HUD layer.
- **Keybinding constraint:** NOT `A` — WASD is reserved for manual flight.
- **Current binding (provisional):** `Tab`. This **conflicts** with the existing next-planet cycler at `src/main.js:6076` / `:6120` (docstring at `src/main.js:6806`: *"Tab=next planet, 1-9=planet#"*). `P` was the Director's first candidate but is already bound (settings-panel toggle at `src/main.js:5738`). Max's call: accept the `Tab` conflict provisionally; the full keyboard-shortcut redesign is tracked as a separate GTD task and is the right vehicle to settle next-planet cycling + autopilot toggle + any other overlaps in one pass. See §Keybinding below.
- **Toggle on (after being off):** must be **explicit** — no auto-resume. Player must click the indicator or press the key.

## Keybinding (provisional — pending keyboard-shortcut redesign)

**Current binding:** `Tab` — autopilot on/off toggle.

**Why provisional:** `Tab` is already bound at `src/main.js:6076` / `:6120` to cycle to the next planet (control docstring at `src/main.js:6806`: *"Tab=next planet, 1-9=planet#"*). The first candidate `P` was already taken (settings-panel toggle at `src/main.js:5738`). Max's decision (2026-04-20, exact words): *"This does impact the user experience when on autopilot and when in manual control. But for the time being, let's just reassign Tab to be autopilot on off."*

**Durable fix:** a full keyboard-shortcut redesign across autopilot + in-system navigation (`Tab`, `1-9` planet jumps, anything else that's accreted). Tracked as a GTD task by working-Claude. Until that workstream lands, the `Tab`-autopilot-overlap is accepted cost and next-planet-cycling is temporarily displaced.

**Honest naming in this doc.** Don't hide the conflict at code-time. The redesign workstream is the place to settle it; this doc flags it so the redesign scope is concrete when that workstream opens.

## End-state + next-system loop

Tour completes → existing warp-selection logic presents next-star options → player or autopilot initiates warp → new system → tour begins again.

**Director note on the existing warp-select UX:** Max invited challenge here. The potential conflict: HUD is *hidden* during autopilot; the warp-select menu is a HUD element. If the tour-complete-then-warp-select handoff causes the HUD to reappear *before* the player has signaled interaction, it breaks the cinematic hold. Working-Claude's implementation needs to decide: (a) warp-select also shows through the cinematic HUD-hide (with a small indicator that interaction is available), or (b) tour-complete is itself a "player interaction" event that restores the HUD, or (c) autopilot auto-initiates the next warp after a beat if the player hasn't acted. The existing mechanism should be preserved if possible, but one of these three resolutions is needed; flagging now so it isn't invented silently at implementation time.

## Manual override — two-layer architecture

When autopilot toggles off:

- **Ship retains angular momentum** (no snap-stop — inertial continuity).
- **Camera can be reoriented freely** (player's eyes unlocked from any ESTABLISHING pan).
- **Player can select another object + burn toward it** (manual-mode targeting).

**This implies a two-layer architecture — load-bearing architectural realization:**

| Layer | Scope | Toggled? |
|---|---|---|
| **Cinematography layer** | Tour orchestration, camera moves, ship choreography, phase selection. | Yes — this is what the autopilot toggle turns on/off. |
| **Navigation subsystem** | Accelerate from A to B, arrive in a stable orbit. Given a target body, produces a motion plan + executes it. | **No — always available.** Reused by manual-mode "burn to" action. |

Manual-mode object-selection + "burn to" uses the **same navigation subsystem** autopilot uses. Autopilot toggle-off doesn't kill acceleration / orbit-establishment — it swaps the caller from cinematography-orchestrator to direct-user-command.

**Director note on today's code (revised 2026-04-20):** the two layers are tangled inside `FlythroughCamera.js`, not inside `AutoNavigator.js`. `AutoNavigator.js` is already cinematography-only (queue + index + linger + `onTourComplete`). `FlythroughCamera` is the monolith: it co-mingles motion execution (position/velocity integration, Hermite travel curves, orbit arc math, approach close-in, descend) with camera state (yaw/pitch, quaternion slerp, free-look offset, lookAt blending). The refactor is a lift-out of motion execution from `FlythroughCamera` into a new navigation-subsystem module; camera state stays put. Working-Claude's first implementation pass should surface this split explicitly; the Director will audit that the split survives V1. *An earlier version of this note named `AutoNavigator` as the monolith — corrected after pre-execution code read.*

## HUD

- **Hides during autopilot.** The cinematic frame should not be overlaid with UI chrome.
- **Reappears on player interaction** — cursor moves to select an object, keyboard input, autopilot-off toggle, etc.
- The upper-left autopilot-status indicator is the **one exception**: it stays visible through HUD-hide, because it's the toggle affordance.

## Audio

- **V1 in scope (no behavior change):** existing audio system stays. BGM determined by system + time-in-system. Toggle sound effects stay.
- **V1 infrastructure in scope:** an **event-surface hook** so a future layer can subscribe to autopilot-state changes and modulate BGM. Not implementing BGM modulation — just emitting the events.
- **Event surface shape (Director call, pending implementation-time review):** a subscribe/emit surface (e.g. `autopilotEvents.on('phase-change' | 'camera-mode-change' | 'toggle', cb)`) rather than a single event with an enum. Rationale: phase transitions, camera-mode transitions, and toggle transitions are three distinct signals a BGM layer would crossfade against differently. A single enum forces the subscriber to reconstruct which axis changed; three events encode the axis in the event name. **Open question** — see below.
- **V2:** actual autopilot → BGM integration (out of this feature's scope; a later workstream subscribes to the event surface this feature ships).

## Gravity drives — ship-body shake on abrupt transitions

**Lore rule:** the player's ship uses a **gravity drive** (see `docs/GAME_BIBLE.md` §8H "Propulsion & Travel Landscape" — canonized in the same Director pass that authored this feature doc). Gravity drives maintain inertial neutrality during smooth cinematic maneuvers — this is why the ship can pull cinematic turns, rapid accelerations, and tight orbits without crushing passengers. The drive is physically plausible in-fiction for the kind of flight this feature composes.

**The compensation envelope has a limit.** When ship motion is abrupt — sudden direction change, aggressive deceleration, a transition that exceeds the drive's smoothing capacity — the compensation *lags* the motion. The lag renders as **visible ship-body shake**: the cinematic tell that something pushed the drive past its envelope.

**Design rule for this feature:** if an autopilot phase transition is abrupt by necessity (unexpected avoidance, emergency deceleration, exit-from-warp velocity mismatch), the implementation **shakes the ship body** during the abrupt moment. This is not a visual gimmick — it's the in-fiction explanation of why smooth cinematic motion is the norm and why the exceptions look punctuated.

**Default cinematic motion does NOT shake.** Shake is the marker of *"the drive is working harder than normal."* Over-using it breaks the "gravity drives maintain inertial neutrality" contract.

**V1 scope — shake fires on two specific phase boundaries.** Per Q5 of the 2026-04-24 interview (Max: *"It's firing at ACCEL and at DECEL. That's acceleration and deceleration. The deceleration shake is at that 10× planet diameter point. And let's just have the acceleration match. Let's just have it be a pure reverse for now."*):

- **ACCEL shake** — fires at **CRUISE onset** (departure from `STATION-A`). The drive is pushing the ship out of rest into cruise velocity — the high d|v|/dt is the trigger.
- **DECEL shake** — fires at **APPROACH onset** (10× body radius). The drive is scrubbing cruise velocity aggressively toward zero — the jumpscare-arrival moment.
- **ACCEL ≡ reverse(DECEL)** for V1. Same shape, opposite sign. Future tuning may differentiate the two; V1 does not.
- **No shake during smooth motion** — no shake mid-CRUISE, no shake during `STATION-A` hold. The shake is the marker of the drive at-envelope, not a frame-punctuation gimmick.

Shake mechanism (camera / ship-mesh additive perturbation) is the same system landed by WS 2 shake-redesign at `1bb5eb2`. This amendment re-specifies *when* it fires; it does not redesign the mechanism.

## OOI citation — what are valid tour subjects / showcase targets / rove candidates

`docs/OBJECTS_OF_INTEREST.md` is the **source-of-truth catalog**. This feature doc does not duplicate the catalog; it cites it.

- **V1 tour subjects** (ship axis — what the ship visits): Category 1 Intra-system bodies — star(s), planets, moons. `AutoNavigator.buildQueue` consumes Category 1.
- **V-later `SHOWCASE` targets**: Category 3 Dynamic events (eclipse, transit, conjunction, ring-plane crossing) + Category 5 Light & composition (crescent, terminator-line, ring-shadow-on-planet, backlit-atmosphere).
- **V-later `ROVING` candidates**: the union of Categories 1, 2 (extra-system features — galactic disk, nebulas, star clusters), 4 (surface detail), and 6 (meta / cinematic).

If a rendering pipeline produces a new kind of thing that autopilot should notice, it's an OOI — add it to `OBJECTS_OF_INTEREST.md`, not here.

## Failure criteria / broken states

The feature has failed if:

- **Ship axis feels "running on rails"** — rigid, mechanical, monotonic. The purpose-and-elegance test is perceptual; if the tour reads as "planet 1, planet 2, planet 3" rather than "a considered passage through this system," the cinematography layer is underbuilt.
- **Camera is rigidly bolted to ship forward with no shake layer** — violates the two-axis decoupling. (V1 `ESTABLISHING` is deliberately thin, but the shake axis on top is the visible evidence that the camera is not hard-coded to the ship's transform.)
- **`ENTRY` pose starts from "above the plane"** — the warp-exit vector has been ignored; the warp → autopilot handoff broke continuity.
- **`STATION-A` reads as "glide in and settle"** — violates the jumpscare-arrival felt criterion (quoted in §Per-phase criteria — `APPROACH`). Gentle close-in with no visible deceleration beat is the failure mode.
- **`STATION-A` body does not fill the frame** — felt-fill ~60% is the criterion. Held body that reads small, with starfield dominating, fails §Per-phase criteria — `STATION-A`.
- **`STATION-A` has orbital motion** — V1 is a hold, not an orbit. Orbital motion in V1 is the `STATION-B` V-later authoring leaking into the wrong workstream.
- **Body drifts off-center during CRUISE/APPROACH** — camera failed to track the autopilot target. Under §A4, the camera reads `target.current_position` each frame; if the body drifts toward the edge of frame as the ship cruises, the per-frame `lookAt` is broken (stale snapshot, wrong target object, or `lookAt` not invoked).
- **Ship overshoots or undershoots target body** — predicted-intercept solver did not converge under realistic cruise speeds and body velocities. Either the quadratic discriminant fell negative under playable conditions (the graceful-fallback at-current-position path fired when it shouldn't have) or the smaller-positive-root selection was wrong. Either failure mode produces a ship that misses its target; AC #1's hit-the-target tolerance bound captures it.
- **APPROACH onset is earlier or later than 10× body radius** — violates Q4. The threshold is the V1 spec until lab tuning adjusts it.
- **ACCEL or DECEL shake fails to fire at its boundary** — the cinematic tell is missing at the very moment it was specified (Q5). ACCEL omitted reads as "ship magically accelerates"; DECEL omitted breaks the jumpscare.
- **Shake fires during smooth motion** — breaks the "inertial neutrality is the norm" lore rule; shake loses its meaning. No shake mid-CRUISE, no shake during `STATION-A`.
- **Star-approach `STATION-A` skims the photosphere** — failure of the safe-distance rule. (The star-orbit-distance workstream lands against this; 10R starting value for APPROACH onset does not apply to stars — safe-distance rule supersedes for stellar bodies.)
- **Hard cut or jump between phases (other than the authored shake-punctuated boundaries)** — same seamlessness principle as warp. ACCEL and DECEL shakes are authored punctuation, *not* hard cuts in the motion field — velocity is still continuous through both, with a spike in d|v|/dt on the derivative axis.
- **Manual override snap-stops the ship** — inertial continuity violated; the two-layer architecture leaked through.
- **Autopilot-on-then-off-then-on auto-resumes** — the "toggle-on must be explicit" rule violated.
- **HUD stays visible during the cinematic hold** — the cinematic frame is compromised.

## Drift risks (Director watch list)

1. **Re-coupling ship + camera axes** under "simplicity." The two-axis structure is V1-mandatory because `SHOWCASE` and `ROVING` require it. Any V1 implementation that bakes `ESTABLISHING` into ship-phase logic (because it's the only camera mode V1 exercises, and V1's `ESTABLISHING` is deliberately thin) is storing an architectural rewrite cost against V-later. The thin V1 camera authoring is *not* a license to collapse the dispatch — the `CameraMode` enum + dispatch ship regardless (§V1 architectural affordances).
2. **Leaking camera state into the navigation subsystem.** `FlythroughCamera` today owns both motion execution and camera state. The refactor temptation is to drag camera state (yaw/pitch, orientation slerp, lookAt blending, free-look offset) into the subsystem along with motion, because today's `beginTravel`/`beginOrbit`/`beginApproach` touch both in one call. If the V1 split is implicit ("it kinda works today") rather than explicit, manual-mode "burn to" will have camera-state side-effects and autopilot-off will not cleanly hand the subsystem over. Clean line: subsystem produces motion plans (position + velocity over time + target framing data); camera module consumes plans and authors its own orientation blend. *Earlier version of this risk named `AutoNavigator` as the monolith — corrected after pre-execution code read.*
3. **`ENTRY` pose reverting to "above the plane."** Today's `DESCEND` hard-codes this. The rename alone doesn't fix it — the start-pose derivation from warp-exit-vector is the substantive change.
4. **Shake overused.** Shake is the marker of the drive working past its envelope. If a developer adds shake to make a transition feel "more impactful," it breaks the inertial-neutrality contract. Shake fires when the *motion* is abrupt, not when we want the *frame* to feel punchy.
5. **"Most interesting first" implemented in V1.** Introduces an OOI-registry runtime dependency that V1 doesn't have. Stick to inner-to-outer queue for V1; revisit when OOI registry is live.
6. **HUD reappears during `ENTRY`** because the warp-select menu closure is still animating or similar. The HUD-hide rule is load-bearing for the cinematic frame.
7. **V-later camera authoring (linger / pan-ahead / departure arc) smuggled into V1.** The 2026-04-24 amendment collapsed V1 `ESTABLISHING` to a minimum. A well-meaning implementation pass that *partially* authors linger or pan-ahead "because the architecture is there" re-imports the V-later scope V1 deliberately discarded. V1 `ESTABLISHING` is: **forward vector + shake, nothing else.** New camera moves wait for their own workstream.
8. **STATION-A drifts toward "orbit" by accident.** Keeping the ship exactly at rest in a scene full of moving bodies is fiddly — reference frames, origin rebasing, parent-body motion can all leak velocity into the held ship. If the held ship begins to drift (even slowly), the V1 spec is violated. Implementation must explicitly pin the ship to the held-pose reference frame, not just set `velocity = 0` once and let downstream subsystems re-author it.
9. **Camera reads stale target position.** Under §A4, the pursuit-curve must read the body's **current** position each frame, not a captured-at-onset snapshot. Variants of the failure: target reference captured at CRUISE onset and never refreshed; lookAt invoked with a copied Vector3 instead of a live reference; the body's parent frame moves but the lookAt target wasn't reparented. All produce a body that drifts off-frame mid-leg. Verification: per-frame camera-to-body angular error (`angle(camera.forward, normalize(body.current_position − camera.position))`) stays below tolerance across the leg.

## Open questions

Decisions parked for implementation-time or Max-time, not resolved in this doc:

- **Main attractor for binary systems:** primary star or barycenter? Both readings of "the system's main attractor" are legal; the felt experience is *"the ship centers itself on the gravitational heart of the system"* — the implementation choice depends on which reads more like that. **Director call:** defer to working-Claude's first implementation — start with barycenter for binaries (closer to the physics the game otherwise honors), but re-evaluate during playtesting if the visual feels unanchored.
- **"Relativistic speeds" in `CRUISE`** — literal (Doppler / aberration effects implied) or just visually fast? **Director call:** V1 is **visually fast** only. Literal relativistic visual effects (blue-shift ahead / red-shift behind) are already `V-later` on the warp feature (`docs/FEATURES/warp.md` §V-later). Autopilot CRUISE shouldn't outrun warp's own polish.
- **`STATION-A` hold felt-fill tuning.** Q2 authored ~60% of screen as the V1 rule. Implementation-time question: what's the exact geometric target (angular diameter? silhouette bounding box? pixel coverage?) that reads as "60% of screen" across the variety of body sizes the game presents. **Director call:** pick the simplest measure that tracks felt intent across moons, Earth-size, and gas giants. Escalate only if felt-fill reads differently at different body scales after lab iteration.
- **`STATION-B` orbit shape, speed ratio, entry/exit discipline.** Deferred to the future ORBIT-mode workstream per Q10 (2026-04-24). Not a V1 open question; noted here so it isn't forgotten at the feature level.
- **First-planet selection — innermost-out vs. most-interesting.** Max flagged this one. **Director call:** V1 stays on innermost-out (existing code + no OOI-registry dependency). V-later revisits when the OOI runtime registry from `docs/WORKSTREAMS/ooi-capture-and-exposure-system-2026-04-20.md` is live. Captured as V-later explicitly in triage above.
- **Keybinding for autopilot-toggle** — not `A`. **Director call (2026-04-20, revised):** `Tab`, **provisional**. Original candidate was `P` (autopilot mnemonic), but working-Claude's bindings-audit found `P` already toggles the settings panel at `src/main.js:5738`. `Tab` was chosen next despite a real conflict with the next-planet cycler (`src/main.js:6076` / `:6120`; control docstring `src/main.js:6806`: *"Tab=next planet, 1-9=planet#"*). Max accepted the conflict as a temporary measure with Max's stated reasoning: *"We are going to have to totally redo the keyboard shortcuts for automatically moving around in the planet system. For the time being, let's just reassign Tab to be autopilot on/off."* The overlap **is real** and affects both autopilot and manual-mode UX — naming it honestly rather than hiding it. **The durable fix is the keyboard-shortcut redesign workstream** (tracked in GTD by working-Claude), which settles autopilot-toggle + next-planet-cycling + any other overlapping binding in one pass. Until that lands, `Tab` is the autopilot toggle and next-planet-cycling is temporarily displaced.
- **Event-surface shape** (single event with state enum vs. three typed events). **Director call above:** three typed events (`phase-change`, `camera-mode-change`, `toggle`). Flag if implementation reveals a subscriber pattern that argues the other way.
- **`AutoNavigator` role-split** — does it cleanly map to the "navigation subsystem" role or need restructuring? Escalated to working-Claude as implementation-time question; this doc asserts the two-layer split is required, not that `AutoNavigator` as-written is the vehicle.
- **Selection-system API for manual-mode object-picking** — exists today or greenfield? Reticle system exists (`docs/SYSTEM_CONTRACTS.md` §5.4) and already does hover/soft-select/commit. Manual-mode "burn to" likely wires through the existing `commitSelection()` + `commitBurn()` path; the question is whether burn-target-resolution needs to re-derive motion from inertial state (it does — the ship already has angular momentum). Flag for working-Claude.

## Workstreams

Child workstream briefs (PM-owned) that carry this feature forward:

- **`docs/WORKSTREAMS/autopilot-star-orbit-distance-2026-04-20.md`** — **Scoped 2026-04-20.** Widens the autopilot's star-approach `STATION` distance so arrival at a star reads as a comfortable long look rather than photosphere-skim. Attacks the `STATION` "safe distance" criterion specifically on star-class bodies. Parent-feature reference in that brief is legacy (§2 + §5.3 of SYSTEM_CONTRACTS) because this feature doc didn't exist when it was authored — **retroactive citation update is tracked as a followup in that brief, not this one.**
- **`docs/WORKSTREAMS/ooi-capture-and-exposure-system-2026-04-20.md`** — **Scoped 2026-04-20.** Ships the OOI catalog + repeatable-process trigger + runtime-registry spec. This feature doc is named as the parent; the PM brief's parent-feature line refers to this doc by name in advance of it landing. **Director action:** on the next audit of that brief, confirm the parent-feature line tightens to cite §Camera axis and §V-later triage specifically.
- **`docs/WORKSTREAMS/warp-phase-perf-pass-2026-04-20.md`** — **Active 2026-04-20.** Not a direct autopilot workstream, but the `ENTRY` phase is the warp→autopilot handoff; perf hitches at the warp-exit moment break the `ENTRY` "velocity preserved as continuity anchor" criterion. Flagged for cross-reference; no scope overlap.
- **`docs/WORKSTREAMS/autopilot-camera-axis-retirement-2026-04-23.md`** — **Scoped 2026-04-23.** WS 3 of 4 in the V1 autopilot sequence. Lands the `CameraMode` enum as a first-class dispatch surface (§10.1 / §133), ships `ESTABLISHING` as the V1 authored camera mode (independent pacing, linger on receding subjects, pan-forward toward incoming targets), wires the §10.9 OOI query stub interface, and emits `camera-mode-change` on the autopilot event-surface per §10.7. `SHOWCASE` and `ROVING` are architecturally present but unexercised. Premise note: WS 1 already retired the legacy `FlythroughCamera.State` enum — this workstream's actual work is the camera-axis dispatch + ESTABLISHING authoring, not the enum removal described in an earlier framing.
- **`docs/WORKSTREAMS/autopilot-phase-transition-velocity-continuity-2026-04-23.md`** — **HELD — REJECTED 2026-04-24, telemetry insufficient.** Continuity-blend workstream across the three phase-transition seams (STATION→CRUISE, TRAVEL→APPROACH, APPROACH→ORBIT). Code at `f90ae2e` is preserved in git; the workstream is held until the new reckoning telemetry lands and the code is re-audited against observables that describe what Max sees in the 3D scene.
- **`docs/WORKSTREAMS/autopilot-telemetry-reckoning-2026-04-24.md`** — **VERIFIED_PENDING_MAX `f652a40` 2026-04-24 (observer).** Adds six telemetry-field extensions (all-bodies snapshot, camera angular rates, camera FOV, ship speed in light-years/s, ship-to-body distance + approach rate, body angular coordinates in view) + a shake-event log, and three new audit helpers (`cameraViewAngularContinuity`, `bodyInFrameChanges`, `shakeVelocityCorrelation`) plus `runAllReckoning`. Observer workstream; no behavioral changes. Retroactive-diagnosis appendix names 11 `cameraViewAngularContinuity` violations + 18 `bodyInFrameChanges` violations on the Shipped code — those issues are the scope of the live-feedback workstream below.
- **`docs/WORKSTREAMS/autopilot-live-feedback-2026-04-24.md`** — **HELD 2026-04-24 — pending Director audit.** Foundational scope-expansion workstream. Promotes the reckoning telemetry from observer to pipeline input at three named consumer sites: (b) `NavigationSubsystem` reads live per-body position for the seam-blend target instead of T₀-captured velocity extrapolation (resolves moon-motion reconciliation at seams); (c) `ShipChoreographer` onset gate augmented with a local-maximum detector on `smoothedAbsDSpeed` (resolves shake-at-random concern); (a) `EstablishingMode` adds a frame-to-frame angular-rate clamp on the raw target (resolves PANNING_AHEAD/APPROACH head-turn + quarter-second-glance). Supersedes continuity round-2 scope; defers shake-redesign + WS 3 reopening; Shipped flip is the gate for continuity re-audit + WS 4 greenlight.
- **`docs/WORKSTREAMS/autopilot-telemetry-coverage-2026-04-23.md`** — **SUPERSEDED 2026-04-24** by the reckoning brief above. Retained as a redirect stub + parked-scope record (pinned-star pixel-check harness + retroactive WS 3 camera-axis audits; pick up if future sessions need that specific coverage shape).
- **`docs/WORKSTREAMS/autopilot-station-hold-redesign-2026-04-24.md`** — **HELD 2026-04-24 — pending Director audit.** V1 implementation of the 2026-04-24 STATION-hold motion-model amendment (this feature doc §"Revision history" 2026-04-24 entry). Carries Loop (a)-class work forward from the live-feedback close-out under correct framing: V1 ship axis (CRUISE aim-once + APPROACH hard-onset at 10R + STATION-A body-locked felt-fill hold); V1 camera axis (ESTABLISHING = ship-forward + shake, nothing else); ACCEL/DECEL shake at CRUISE/APPROACH boundaries (pure-reverse); ship-orientation precondition (AC #7 — `forward`/`up` as authored properties of the ship object, readable at rest); stub scaffolding removal (AC #9). Substrate: Loops (b) + (c) from live-feedback (`Shipped 3ba1159` + `273e725`) + the `(α)` stub recording at `screenshots/max-recordings/stub-saturn-v4-2026-04-24.fixed.webm` as AC #8 felt-experience reference.
- **`docs/WORKSTREAMS/realistic-celestial-motion-2026-04-27.md`** — **Active — scoped 2026-04-27.** Adjacent (not direct child) workstream that touches autopilot's environment, not its mechanism. Replaces the project's accelerated celestial motion (orbits ~6280× realistic, rotations ~24× realistic) with true realistic by default, plus a logarithmic user slider (1× realistic → 10000× game-fast) for `celestialTimeMultiplier`. Centralizes realism factors in a new `src/core/CelestialTime.js`, threads one consistent `celestialDt` through every site that advances celestial state (planet/moon orbit + rotation, asteroid orbit, binary-star orbit). Cascading benefit on §A7 lhokon body-lock drift (AC #5 of that brief): at realistic speeds, body-lock translation drift collapses below FP noise floor; APPROACH overshoot reported by Max at HEAD `01caf00` is structurally suppressed at multiplier 1× and reproduces at 1000× (proving cause). Out of scope: per-system speed overrides, time-rewind, eclipse-precise phasing, distance-scale uncompression, autopilot tuning re-pass (parking-lot if felt experience shifts at realistic). Saved-fresh-install default value deferred to Max during implementation.

Future workstreams (not yet scoped) that will advance this feature:

- Ship-motion greenfield — the four ship-axis phases as a motion system, replacing today's single-axis `FlythroughCamera`. **Landed by WS 2 `autopilot-ship-axis-motion-2026-04-20.md` + `autopilot-shake-redesign-2026-04-21.md`.**
- Camera-axis decoupling — the two-axis dispatch, shipping `ESTABLISHING` as the V1 camera mode. **Scoped 2026-04-23 as `autopilot-camera-axis-retirement-2026-04-23.md` (above).**
- Autopilot-toggle UI — the upper-left status indicator + keybinding.
- Audio event-surface hook — the emit-without-subscribers V1 surface. **Partially landed by WS 3 above (`camera-mode-change` event). `phase-change` + `toggle` events remain — WS 4 scope.**
- Gravity-drive shake mechanism — camera / ship-mesh additive perturbation system. **Landed by WS 2 shake-redesign at `1bb5eb2`.**

## Parking lot

Issues observed but consciously **parked** — not yet a scoped workstream, not merged into an adjacent one, preserved here so they don't rot.

### Travel-feel speed-field — planet↔moon "one gear / arrives too far / accelerating too quickly" (parked 2026-04-22)

**Felt issue.** Max, verbatim: *"one gear / arrive-too-far / accelerating too quickly"* — observing the planet→moon (and moon→moon) legs of the tour. Restated: the ship seems to have a single travel gear regardless of leg length; short hops feel over-powered (too much acceleration for the distance), and the arrival `STATION` sits farther out than the body's size + visual intimacy warrant. The motion reads mechanical rather than *considered*.

**Code-level mechanics driving the feel.** Four couplings combine to produce it:

- **Travel-duration √-compression + 4s floor.** The tour scales leg duration by `sqrt(distance)` and floors short legs at ~4s. Short legs (planet↔moon) get the floor, which means the drive must cover a small distance in a fixed minimum time — enforcing a uniform-feeling gear.
- **Linear tangent magnitude.** The Hermite travel curve uses a tangent magnitude that scales linearly with leg distance, not with a speed-envelope that respects what the scene "wants" at that scale.
- **0.06 orbit-distance floor at moons.** `STATION` around moons clamps at a 0.06 orbit-distance floor, which at moon sizes reads as "too far" — the body doesn't fill the frame the way the `STATION` criteria call for.
- **Non-zero Hermite start-tangent.** The travel curve's start-tangent is non-zero by design (continuity across legs), which means there's no easing-in on `|v|` — velocity magnitude is already non-trivial at leg start, contributing to the "accelerating too quickly" read on short hops.

**Reference point.** Elite Dangerous Supercruise models top-speed as a **field over space** — a function of proximity to gravity wells, not a scalar constant. Ships slow *automatically* near mass; the speed envelope itself is part of the world. What Well Dipper's autopilot currently exposes is a single-gear approximation of this; the felt gap is the gap between a scalar drive and a speed-field drive.

**Park-or-scope decision.** Parked. Not merged into the continuity workstream (different concern — continuity is about cross-phase handoffs, not speed-field shape). Not scoped as a new workstream yet — the articulation needs to happen at the **feature level** first (what *is* the speed field, what does it couple to, what does top-speed mean at what scales) before a PM brief can sensibly scope execution. Revisit after **shake-redesign Shipped + WS 3 greenlight** — that's the natural next gate where the travel layer gets fresh attention and a speed-field re-scope has the right context.

**Future-workstream scope IF activated.** Feature-level questions to answer before any PM scoping:
- Speed-field *shape*: is top-speed a smooth function of distance from the nearest / dominant attractor, or a piecewise envelope (intra-body / intra-system / inter-system tiers)?
- Top-speed envelope at each scale: what's the felt upper bound near moons vs. planets vs. clear space vs. near a star?
- Gravity-well coupling: does the field fall off with `1/r`, `1/r²`, or some game-feel curve? Multi-body superposition or dominant-attractor-only?
- How does the field interact with the existing `STATION` orbit-distance clamps — does the clamp become emergent from the field, or stay as an independent floor?
- Does this replace the √-compression / 4s floor outright, or compose with them?

Once those answers exist at the feature level, a PM workstream can scope the travel-layer rewrite with acceptance criteria tied to the felt outcomes (short hops *feel short*, `STATION` *feels intimate*, the drive *reads considered*).

## See also

- `docs/GAME_BIBLE.md` §1 Core Experience (vision anchor), §8H Propulsion & Travel Landscape (gravity-drive lore), §2 Aesthetic (60s/70s register).
- `docs/SYSTEM_CONTRACTS.md` §Autopilot (bootstrapped in the same Director pass as this doc — formal contracts for the state machine, the two-layer architecture, and the event surface).
- `docs/SYSTEM_CONTRACTS.md` §5 Camera and Control (Toy-Box / Flight mode × Manual / Autopilot / Warp drive-state matrix).
- `docs/SYSTEM_CONTRACTS.md` §9 Warp (ENTRY is the handoff boundary — the warp-exit vector is the continuity anchor).
- `docs/RESEARCH_transit-propulsion.md` §2.5 Gravity Drives / Inertialess Drives (research-stage treatment).
- `docs/OBJECTS_OF_INTEREST.md` (OOI catalog — v0, 2026-04-20).
- `docs/FEATURES/warp.md` (sibling feature — warp exits into autopilot's `ENTRY`).
