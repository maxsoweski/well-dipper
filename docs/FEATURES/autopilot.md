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

**Ship axis** (4 phases — where is the ship, what is it doing):

| Phase | Was | Means |
|---|---|---|
| `ENTRY` | renamed from `DESCEND` | Arrive along the warp-exit vector. Today's DESCEND assumes "from above" — wrong. Start pose is **derived from the warp-exit forward direction**, not from a fixed above-the-plane origin. |
| `CRUISE` | renamed from `TRAVEL` | Sustained travel between bodies at high fraction-of-c speeds. Elegant, purposeful, unhurried by default. |
| `APPROACH` | kept | Deceleration + attitude change as the target body's reticle/billboard expands into a real disk. |
| `STATION` | retired `ORBIT` | Holding pattern near a body. Ship is in motion throughout (not stationary) — orbital arc with dynamic feel. |

**Camera axis** (3 modes — what are the player's eyes doing, orthogonal to ship axis):

| Mode | V1? | Means |
|---|---|---|
| `ESTABLISHING` | **V1** | Wide, slow, takes in the whole frame. The Blue Danube opener. Follows ship phases but paces itself independently — can linger on a receding STATION subject as the ship begins CRUISE, then pan forward to the next target. |
| `SHOWCASE` | V-later | The cinematographer beat. Framed shots of crescent, eclipse, ring-shadow, moon transit, light on terrain. Queries `docs/OBJECTS_OF_INTEREST.md` §5 Light & composition. |
| `ROVING` | V-later | Player-eye freedom, 360°, curious. "Turn head" toward nearby objects of interest. Queries `docs/OBJECTS_OF_INTEREST.md` §1–§6. |

**Taxonomies compose.** Camera mode is selected per-moment, not per-ship-phase. `STATION + SHOWCASE` = eclipse framing while ship arcs around a body. `CRUISE + ROVING` = looking out the window en route. `ENTRY + ESTABLISHING` = arrival reveal.

**`ORBIT` is retired.** The current conflated state is rewritten by this feature. `STATION` lives on the ship axis; `SHOWCASE` lives on the camera axis; the old fusion of the two is gone. Any new code that reintroduces a single combined "orbit-and-frame" state is a regression against this structure.

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

- Elegant initiation from the attractor `STATION` — linger, pan, burn.
- Picks up to **relativistic speeds** toward the target (see Open questions: literal-or-felt).
- Target's reticle/billboard is still ahead in the frame for most of the phase; the handoff to `APPROACH` is the moment it starts resolving into real geometry.
- **Entry continuity (STATION → CRUISE).** The ship's velocity at CRUISE frame 1 reads as continuous with the prior STATION's terminal velocity — no visible hitch at the moment the ship leaves orbit. The transition is a camera + choreography moment, not a hard cut (restated from `ENTRY`'s §"Elegantly initiates `CRUISE`").

### `APPROACH` — deceleration

- **The reticle→disk transition is load-bearing.** The moment the target stops being a billboard and becomes a real 3D body is itself part of the felt experience — not a technical detail. LOD handoff timing is a phase criterion, not a rendering implementation detail to hide.
- Progressive deceleration. No sudden speed step; the drive compensates smoothly (see §Gravity drives).
- Body fills more and more of the frame.
- Seamless handoff to `STATION`.
- **Entry continuity (CRUISE → APPROACH).** The ship's velocity at APPROACH frame 1 reads as continuous with CRUISE's terminal velocity — the "progressive deceleration" criterion above is violated the moment the velocity direction flips rather than bends. No visible hitch at the moment travel ends and close-in begins.

### `STATION` — holding pattern

- **Orbit, not stationary.** Ship is in motion throughout.
- **Orbit speed fast relative to planet size** (dynamic feel — the planet rotates visibly beneath the observer during the hold).
- **But not so fast the planet feels small.** Tight orbit, immersive — close enough that the planet is "ground" and the starfield is "sky."
- **Arc sees more than the arrival view** — the camera + ship motion together reveal surface / cloud patterns / terminator line that the `APPROACH` frame didn't.
- **Entry continuity (APPROACH → STATION).** The ship's velocity at STATION frame 1 reads as continuous with APPROACH's terminal velocity — restatement of the `APPROACH` phase's "Seamless handoff to `STATION`" criterion at the velocity-derivative level. No visible hitch as the ship settles into orbit.

### First-planet selection

Current code (`AutoNavigator.buildQueue`) visits inner-to-outer. Director's note inline at §Open questions — the "most interesting first" rule likely reads better than monotonic distance order, but it introduces a dependency on OOI-registry runtime queries that don't exist in V1. V1 stays on inner-to-outer; V-later reconsiders when the OOI registry is live.

## Per-phase criterion — camera axis (V1)

### `ESTABLISHING` — wide/slow framing that follows ship phases independently

- Default camera mode for V1. Paces with the ship phase but **is not coupled to it frame-for-frame.**
- Can **linger** on a receding subject as the ship begins the next phase (e.g. on the planet the ship just finished `STATION`-ing, while the ship starts `CRUISE` toward the next body).
- Can **pan forward** toward the direction the ship is heading, ahead of the ship's arrival.
- Wide FOV, slow angular velocity, composed framing.
- **Does NOT** rove 90° off-path to look at a nebula for its own sake. That's `ROVING` (V-later).
- **Does NOT** zoom to a specific compositional beat like a crescent-at-terminator. That's `SHOWCASE` (V-later).

## V1 / V-later triage

### V1 — must ship

- **All 4 ship phases** (`ENTRY`, `CRUISE`, `APPROACH`, `STATION`) — ship motion is greenfield; it doesn't exist today.
- **Warp-exit-vector arrival pose** — `ENTRY` start is derived from the warp forward direction, not a fixed above-the-plane origin.
- **Ship/camera decoupling architecture** — the two-axis structure must be in place at V1 even though only `ESTABLISHING` is exercised on the camera axis.
- **`ESTABLISHING` camera mode** — paces independently of ship phase, can linger/pan.
- **Toggle UI** — status indicator upper-left + keybinding (`Tab`, **provisional** — see §Keybinding below).
- **Default-ON state** — autopilot is the default, not opt-in.
- **Manual override with inertial continuity** — toggling off preserves angular momentum; no snap-stop.
- **HUD hide-during-autopilot / reappear-on-interaction.**
- **Audio event-surface hook** — future BGM layer can subscribe to autopilot-state changes. The hook ships in V1; the modulation doesn't.
- **Gravity-drive shake on abrupt transitions** — the cinematic tell (see §Gravity drives).
- **Star-orbit safe-distance rule** — the star-orbit-distance workstream lands against this criterion.
- **Ship phase transitions must feel continuous** — no visible hitch at `STATION → CRUISE`, `CRUISE → APPROACH`, or `APPROACH → STATION`. Each transition satisfies its per-phase entry-continuity criterion above. The phase-transition velocity continuity workstream (`docs/WORKSTREAMS/autopilot-phase-transition-velocity-continuity-2026-04-23.md`) lands against this bullet.

### V-later — polish, must graft on without architectural rewrite

- `SHOWCASE` camera mode (framed compositional beats — crescent, eclipse, ring-shadow, transit).
- `ROVING` camera mode (player-eye freedom, 360° turn-head-toward-OOI).
- OOI runtime registry (the query substrate `SHOWCASE` and `ROVING` consume at runtime — workstream at `docs/WORKSTREAMS/ooi-capture-and-exposure-system-2026-04-20.md`).
- Proactive OOI geometric-beat detectors (eclipse-upcoming, ring-plane crossing, moon-transit).
- Actual autopilot→BGM integration (V1 ships the event-surface hook; V-later subscribes the music layer to it).
- "Most interesting first" planet selection (replaces inner-to-outer queue).

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

**V1 scope:** the shake *mechanism* is V1 (camera / ship-mesh perturbation accepting an additive shake input, driven by a shake-strength value). V1 autopilot flight is smooth enough that the shake rarely fires — but the mechanism is ready for any phase transition that later tuning judges too abrupt, and for manual-override hand-back (the moment the player grabs control at speed the drive had been anticipating).

## OOI citation — what are valid tour subjects / showcase targets / rove candidates

`docs/OBJECTS_OF_INTEREST.md` is the **source-of-truth catalog**. This feature doc does not duplicate the catalog; it cites it.

- **V1 tour subjects** (ship axis — what the ship visits): Category 1 Intra-system bodies — star(s), planets, moons. `AutoNavigator.buildQueue` consumes Category 1.
- **V-later `SHOWCASE` targets**: Category 3 Dynamic events (eclipse, transit, conjunction, ring-plane crossing) + Category 5 Light & composition (crescent, terminator-line, ring-shadow-on-planet, backlit-atmosphere).
- **V-later `ROVING` candidates**: the union of Categories 1, 2 (extra-system features — galactic disk, nebulas, star clusters), 4 (surface detail), and 6 (meta / cinematic).

If a rendering pipeline produces a new kind of thing that autopilot should notice, it's an OOI — add it to `OBJECTS_OF_INTEREST.md`, not here.

## Failure criteria / broken states

The feature has failed if:

- **Ship axis feels "running on rails"** — rigid, mechanical, monotonic. The purpose-and-elegance test is perceptual; if the tour reads as "planet 1, planet 2, planet 3" rather than "a considered passage through this system," the cinematography layer is underbuilt.
- **Camera feels locked to ship** — the player's eyes can't linger, can't pan independently. Violates the two-axis decoupling.
- **`ENTRY` pose starts from "above the plane"** — the warp-exit vector has been ignored; the warp → autopilot handoff broke continuity.
- **`STATION` is stationary** — violates "ship in motion throughout."
- **`STATION` is too far** — planet doesn't feel like "ground"; starfield dominates. Failure of the immersion criterion.
- **`STATION` is too fast** — planet feels small, whipped-around. Failure of the "dynamic but not frenetic" criterion.
- **Star-approach `STATION` skims the photosphere** — failure of the safe-distance rule. (This is the symptom the star-orbit-distance workstream fixes.)
- **Hard cut or jump between phases** — same seamlessness principle as warp: motion continuity across visual + audio + temporal axes.
- **Manual override snap-stops the ship** — inertial continuity violated; the two-layer architecture leaked through.
- **Autopilot-on-then-off-then-on auto-resumes** — the "toggle-on must be explicit" rule violated.
- **HUD stays visible during the cinematic hold** — the cinematic frame is compromised.
- **Gravity-drive shake fires during smooth motion** — breaks the "inertial neutrality is the norm" lore rule; shake loses its meaning.
- **Gravity-drive shake fails to fire on genuinely abrupt motion** — the cinematic tell is missing; abruptness reads as a bug rather than an in-fiction event.

## Drift risks (Director watch list)

1. **Re-coupling ship + camera axes** under "simplicity." The two-axis structure is V1-mandatory because `SHOWCASE` and `ROVING` require it. Any V1 implementation that bakes `ESTABLISHING` into ship-phase logic (because it's the only camera mode V1 exercises) is storing an architectural rewrite cost against V-later.
2. **Leaking camera state into the navigation subsystem.** `FlythroughCamera` today owns both motion execution and camera state. The refactor temptation is to drag camera state (yaw/pitch, orientation slerp, lookAt blending, free-look offset) into the subsystem along with motion, because today's `beginTravel`/`beginOrbit`/`beginApproach` touch both in one call. If the V1 split is implicit ("it kinda works today") rather than explicit, manual-mode "burn to" will have camera-state side-effects and autopilot-off will not cleanly hand the subsystem over. Clean line: subsystem produces motion plans (position + velocity over time + target framing data); camera module consumes plans and authors its own orientation blend. *Earlier version of this risk named `AutoNavigator` as the monolith — corrected after pre-execution code read.*
3. **`ENTRY` pose reverting to "above the plane."** Today's `DESCEND` hard-codes this. The rename alone doesn't fix it — the start-pose derivation from warp-exit-vector is the substantive change.
4. **Shake overused.** Shake is the marker of the drive working past its envelope. If a developer adds shake to make a transition feel "more impactful," it breaks the inertial-neutrality contract. Shake fires when the *motion* is abrupt, not when we want the *frame* to feel punchy.
5. **"Most interesting first" implemented in V1.** Introduces an OOI-registry runtime dependency that V1 doesn't have. Stick to inner-to-outer queue for V1; revisit when OOI registry is live.
6. **HUD reappears during `ENTRY`** because the warp-select menu closure is still animating or similar. The HUD-hide rule is load-bearing for the cinematic frame.

## Open questions

Decisions parked for implementation-time or Max-time, not resolved in this doc:

- **Main attractor for binary systems:** primary star or barycenter? Both readings of "the system's main attractor" are legal; the felt experience is *"the ship centers itself on the gravitational heart of the system"* — the implementation choice depends on which reads more like that. **Director call:** defer to working-Claude's first implementation — start with barycenter for binaries (closer to the physics the game otherwise honors), but re-evaluate during playtesting if the visual feels unanchored.
- **"Relativistic speeds" in `CRUISE`** — literal (Doppler / aberration effects implied) or just visually fast? **Director call:** V1 is **visually fast** only. Literal relativistic visual effects (blue-shift ahead / red-shift behind) are already `V-later` on the warp feature (`docs/FEATURES/warp.md` §V-later). Autopilot CRUISE shouldn't outrun warp's own polish.
- **`STATION` orbit-speed ratio** — what's a specific measurable? **Director call:** unresolved at vision-time; this is an implementation-tuning value best set during a visual-lab iteration. The criterion is perceptual ("fast relative to planet size" AND "not so fast the planet feels small"). Escalate to Max only if the tuning range is genuinely ambiguous after lab iteration.
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
