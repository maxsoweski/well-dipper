# Workstream: Autopilot toggle UI, manual override, warp-select integration (2026-04-20)

## Status

Scoped — awaiting working-Claude execution. Fourth of four sequential
workstreams delivering V1 autopilot. **Depends on
`autopilot-navigation-subsystem-split-2026-04-20.md` (WS 1, commit
`656ded3`), `autopilot-ship-axis-motion-2026-04-20.md` (WS 2, commit
`2be6f37`), and `autopilot-camera-establishing-2026-04-20.md` (WS 3,
pending commit) landing first.** See
`docs/FEATURES/autopilot.md` §"Workstreams" for the full sequence and
the sibling WS 3 brief's §"Sequencing" section for the execution order
across all four.

Drafted by PM 2026-04-20 as WS 4 of 4 in the V1 autopilot sequence.

## Parent feature

**`docs/FEATURES/autopilot.md`** — Director-authored 2026-04-20 at
commit `bdeb0ff` with keybinding update at `4b9b18a`.

Specific sections this workstream serves:

- **§"Trigger / toggle / UI (V1)"** — clickable upper-left status
  indicator; `Tab` keybinding (provisional, conflicts with existing
  next-planet cycler); default-ON from system-load; explicit-only
  re-engagement after toggle-off (no auto-resume).
- **§"Keybinding (provisional — pending keyboard-shortcut redesign)"**
  — the full narrative of the `Tab` conflict and why this
  workstream accepts the overlap as temporary measure. The durable
  fix is a separate GTD task for a keyboard-shortcut redesign;
  this workstream does not attempt that redesign.
- **§"End-state + next-system loop"** — tour completes → existing
  warp-selection logic presents next-star options → player or
  autopilot initiates warp → new system → tour begins again. The
  Director explicitly named this section as a place where Max
  invited challenge (the HUD-hide vs. warp-select-is-HUD conflict);
  this workstream pins the resolution in §Drift risks.
- **§"Manual override — two-layer architecture"** — ship retains
  angular momentum; camera can be reoriented freely; player can
  select another object and burn. Routed through WS 1's navigation
  subsystem (which is ALWAYS-AVAILABLE per §10.3).
- **§"HUD"** — hides during autopilot, reappears on player
  interaction (cursor motion to selectable body, keyboard input,
  toggle-off event). Upper-left status indicator is the one
  exception — always visible as the toggle affordance.
- **§"Audio"** — event-surface hook emits `phase-change` /
  `camera-mode-change` / `toggle` typed events per §10.7. V1 emits
  with zero subscribers. Existing toggle SFX stay.
- **§"V1 — must ship"** — the bullets this workstream closes:
  *"Toggle UI — status indicator upper-left + keybinding (Tab,
  provisional)."*, *"Default-ON state — autopilot is the default,
  not opt-in."*, *"Manual override with inertial continuity —
  toggling off preserves angular momentum; no snap-stop."*,
  *"HUD hide-during-autopilot / reappear-on-interaction."*,
  *"Audio event-surface hook — future BGM layer can subscribe to
  autopilot-state changes. The hook ships in V1; the modulation
  doesn't."*
- **§"Failure criteria / broken states"** — specifically:
  *"Manual override snap-stops the ship — inertial continuity
  violated; the two-layer architecture leaked through."*,
  *"Autopilot-on-then-off-then-on auto-resumes — the 'toggle-on
  must be explicit' rule violated."*, *"HUD stays visible during
  the cinematic hold — the cinematic frame is compromised."*

Primary contracts:

- **`docs/SYSTEM_CONTRACTS.md` §10.4 Drive-state transitions** —
  the extension of §5.3 with autopilot toggle rules: default-ON at
  system-load; explicit Manual → Autopilot (no auto-resume from
  idle); Autopilot → Warp on tour-complete; Warp → Autopilot on
  warp-exit (`ENTRY` phase, WS 2's concern). **Idle-auto-resume
  is retired — a contract-level change this workstream enforces.**
- **`docs/SYSTEM_CONTRACTS.md` §10.4.1 Autopilot-toggle keybinding
  (provisional)** — `Tab` binding with the real conflict at
  `src/main.js:6076` / `:6120`, the `P` conflict at `src/main.js:5738`,
  Max's decision to accept the conflict temporarily, and the note
  that a future binding change is not a contract violation but the
  expected redesign resolution.
- **`docs/SYSTEM_CONTRACTS.md` §10.6 HUD visibility** — HUD hides
  during autopilot; reappears on player interaction; status
  indicator is the one exception. Generic HUD visible during
  autopilot is a contract violation.
- **`docs/SYSTEM_CONTRACTS.md` §10.7 Audio event-surface hook** —
  three typed events (`phase-change`, `camera-mode-change`,
  `toggle`); V1 emits, zero subscribers inside the codebase
  (adding a subscriber inside V1 is scope creep).
- **`docs/SYSTEM_CONTRACTS.md` §10.3 Two-layer architecture** —
  manual-override "burn to body" uses the SAME navigation
  subsystem autopilot uses; autopilot-off does not kill the
  subsystem, it swaps the caller.

Secondary contracts: §5.3 Drive States (the Manual / Autopilot /
Warp drive-state matrix this workstream wires the transitions
for), §5.4 In-System Targeting (`commitSelection()` +
`commitBurn()` reticle path that manual-override consumes),
§9 Warp (the tour-complete → warp-select handoff).

## Implementation plan

N/A (feature is workstream-sized). This workstream is wiring
work — bringing WS 1's subsystem, WS 2's ship motion, and WS 3's
camera dispatcher to a user-visible autopilot with a toggle, a
HUD policy, a manual-override path, a warp-select handoff, and
an audio event surface. No cross-system state machines beyond
what §10 already supplies. If mid-work the warp-select handoff
resolution reveals architectural complexity beyond the three
options the feature doc §"End-state" names, escalate to PM for
a PLAN doc bootstrap.

## Scope statement

Deliver the end-to-end V1 autopilot experience by wiring the
following user-visible affordances to the architecture WS 1–3
shipped:

1. **Upper-left clickable status indicator** that shows autopilot
   state (on/off) and toggles the drive-state on click. Small,
   integrates with the existing HUD layer, remains visible during
   HUD-hide per §10.6.
2. **`Tab` keybinding** for autopilot toggle. Accepted as
   provisional per §10.4.1; conflicts with the existing
   next-planet cycler at `src/main.js:6076` / `:6120`. Durable
   fix is a GTD-tracked keyboard-shortcut redesign, not this
   workstream. This workstream honors Max's decision to
   temporarily displace next-planet-cycling until the redesign.
3. **Default-ON state from system-load** — autopilot is the
   default mode when the player enters a system, not opt-in. This
   is a §10.4 contract change from the previous "30s idle →
   autopilot resumes" pattern.
4. **Explicit-only Manual → Autopilot transition** — `idle-auto-
   resume is retired.** Any input event (click indicator, press
   Tab) re-engages autopilot; the ship idling does NOT.
5. **HUD hide-during-autopilot / reappear-on-interaction policy**
   per §10.6. The upper-left status indicator is the one
   exception; it remains visible as the toggle affordance. Player
   interaction (cursor motion to a selectable body, keyboard
   input, menu-open, explicit keybind — working-Claude pins the
   exact trigger list; see §Drift risks) triggers HUD reappear.
6. **Manual-override path** — when autopilot toggles off, the
   ship retains angular momentum (inertial continuity, no
   snap-stop), the camera unlocks from ESTABLISHING's pacing
   envelope and can be reoriented freely, and the player can
   select another object via the existing reticle path (§5.4)
   and initiate a burn. **The burn uses WS 1's navigation
   subsystem directly**, not the cinematography layer. This is
   exactly the two-layer split WS 1 authored; the manual-
   override path is where the always-available subsystem is
   exercised.
7. **Warp-select integration at tour-complete** — tour completes
   → existing warp-selection logic presents next-star options →
   player (or autopilot, per feature doc §"End-state" option (c))
   picks → warp begins → new system → autopilot re-engages on
   warp-exit per §10.5 and begins a new tour. Resolution of the
   HUD-hide-vs-warp-select-is-HUD conflict is pinned in §Drift
   risks.
8. **Audio event-surface hook** per §10.7 — three typed events
   emitted by autopilot (`phase-change`, `camera-mode-change`,
   `toggle`). V1 emits with **zero subscribers inside the
   codebase**; existing toggle SFX stay on their current code
   path (working-Claude does NOT re-plumb existing SFX through
   the new event surface in V1). V-later BGM layer subscribes.

This is one unit of work because the affordances are entangled
at the UX layer: the toggle keybinding triggers HUD reappear;
the manual-override path requires the HUD to be visible enough
to select a target; the warp-select handoff requires deciding
how HUD visibility interacts with the end-state; the audio
event surface emits on toggle events. Splitting across briefs
would produce a half-wired autopilot that the user experiences
as broken (toggle exists but HUD doesn't hide; HUD hides but
manual-override can't find a target; etc.).

**Explicitly excluded from the bundle:** the keyboard-shortcut
redesign (`Tab` conflict resolution). The feature doc
§"Keybinding" makes this a separate GTD task and the
contracts §10.4.1 codifies that the provisional binding will
change. **THIS workstream does NOT touch the existing
`src/main.js:6076`/`:6120` next-planet cycler logic, does NOT
redesign `1-9` planet jumps, does NOT move the settings-panel
`P` binding.** It only wires `Tab` to the autopilot toggle
alongside (displacing, in practice) the next-planet cycler.

## How it fits the bigger picture

Advances `docs/GAME_BIBLE.md` §1 Vision / Core Experience — the
autopilot is "the game's cinematic tour mode" (feature doc
§"One-sentence feature") and this workstream is what makes it a
**mode** rather than a piece of infrastructure. A mode has a
toggle, a default state, a visible indicator, a way for the
player to step in and out. Without this workstream, WS 1–3's
architecture exists but is not a user-facing mode — the player
has no affordance to engage or disengage, the HUD fights the
cinematic frame, and the tour-complete state has no handoff.

Advances `docs/GAME_BIBLE.md` §11 Development Philosophy:

- **Principle 6 — First Principles Over Patches.** The retirement
  of idle-auto-resume is a first-principles move. The existing
  30s-idle-resume pattern is a patch that accumulated when the
  game's UX was built around "autopilot is on unless you're
  actively flying." The new model is "autopilot is a mode; you
  enter and exit explicitly." The patch goes.
- **Principle 2 — No Tack-On Systems.** The manual-override path
  is the headline test. If manual-override re-invents motion
  execution outside the navigation subsystem, §10.3's invariant
  is violated. If it routes through the cinematography layer,
  it inherits tour-queue side effects (autopilot resuming
  because the burn "completed"). The clean path is through the
  always-available subsystem; anything else is a tack-on.
- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes.** The status indicator + HUD are renderer concerns.
  They read autopilot state (a cinematography-layer property) and
  render accordingly; they don't write back to autopilot state
  except through the explicit click/keybind affordance. The audio
  event surface emits state transitions outward; nothing inside
  the autopilot consumes them in V1.

Advances the **player trust** dimension that the feature doc's
§"Heart's desire" implies. Max's language: *"Wonder and
interest. Like a human navigator + cinematographer taking viewers
on a tour."* A tour that the player cannot interrupt is not a
tour — it's a cage. The manual-override path is what makes it a
tour: the player trusts the autopilot BECAUSE they can step out
at any moment with a clean handoff, not because they're forced
to stay.

## Acceptance criteria

Phase-sourced per `docs/PERSONAS/pm.md` §"Per-phase AC rule."
This is a user-facing workstream with interactive behavior —
the Shipped-gate uses **motion evidence** per
`docs/MAX_RECORDING_PROTOCOL.md` (canvas-path) and
`feedback_motion-evidence-for-motion-features.md`. Several ACs
are wired-behavior-observable-in-recording; a few are
grep/code-read verifiable.

1. **Upper-left clickable status indicator exists and renders
   correctly in both states** (per `docs/FEATURES/autopilot.md`
   §"Trigger / toggle / UI (V1)": *"clickable status indicator
   in upper-left of screen … The indicator is a small element,
   clickable, integrates with the existing HUD layer."*).
   Verified in Max's primary canvas recording: a small upper-
   left element is visible with autopilot-on styling during
   autopilot; a visually-distinct autopilot-off styling during
   manual mode. Click lands a toggle. Working-Claude picks
   styling (working-Claude's call — document in the commit).

2. **Status indicator remains visible during HUD-hide** (per
   §10.6 exception). Verified in Max's primary recording: after
   the rest of the HUD hides on autopilot engage, the upper-left
   status indicator is still visible. If the rest of the HUD
   is gone and the indicator is gone, AC #2 fails — the
   indicator is the one exception.

3. **`Tab` keybind toggles autopilot on/off** per §10.4.1 and
   feature doc §"Keybinding." Verified in Max's primary recording:
   pressing `Tab` during autopilot transitions to manual mode;
   pressing `Tab` during manual transitions to autopilot
   (explicit re-engage). The binding is honored even though it
   conflicts with next-planet cycling — working-Claude documents
   the conflict in the code comment at the `Tab` handler.

4. **Autopilot is default-ON at system-load** (per `docs/SYSTEM_CONTRACTS.md`
   §10.4: *"Default. Autopilot is on at system-load, not opt-in."*).
   Verified in Max's primary recording: the recording starts from
   warp-exit into a new system, and the autopilot is engaged
   without the player having to click or press anything. The
   indicator reads on. The tour begins.

5. **No auto-resume from idle** (per `docs/SYSTEM_CONTRACTS.md`
   §10.4: *"Explicit only … No auto-resume from idle. This is a
   change from the previous '30s idle → autopilot resumes'
   pattern."*). Verified by: (a) grep for "idle-auto-resume" or
   the equivalent symbol in `ShipCameraSystem` / elsewhere, zero
   references remaining; (b) in Max's primary recording, after a
   manual-toggle-off, the player is shown holding steady for
   >30s (the old threshold) without autopilot re-engaging.
   Autopilot re-engages ONLY on explicit click/Tab.

6. **HUD hides during autopilot** (per `docs/SYSTEM_CONTRACTS.md`
   §10.6 and feature doc §"HUD"). Verified in Max's primary
   recording: after autopilot engages from warp-exit, the
   general HUD chrome (reticle, target info, nav readouts,
   anything that was visible in manual mode) is hidden. The
   cinematic frame is clean. The status indicator from AC #2
   is the exception.

7. **HUD reappears on player interaction OR tour-complete** (per
   `docs/FEATURES/autopilot.md` §"HUD": *"Reappears on player
   interaction — cursor moves to select an object, keyboard
   input, autopilot-off toggle, etc."*). The exact trigger list
   is soft in the feature doc and this workstream pins it —
   **V1 trigger list (four player-side + one system-side):**
   - **Player-side:** (a) cursor motion to a selectable body
     (existing reticle hover behavior), (b) any keyboard input
     that maps to an in-game action (Tab, WASD, 1-9, Escape,
     etc. — not modifier keys alone), (c) commitSelection event
     fired from reticle path, (d) menu-open (settings,
     warp-select).
   - **System-side:** (e) tour-complete — the cinematography
     layer's queue-exhaust event is itself a HUD-restore trigger
     per AC #10's resolution (b). Distinguished from the four
     player-side triggers because it isn't initiated by player
     input; it's initiated by the cinematography layer reaching
     the end of its queue. This trigger is what opens the
     warp-select handoff; Director added it in the 2026-04-20
     audit so AC #7 and AC #10 align explicitly rather than
     AC #10 pinning a behavior AC #7 doesn't list.

   Verified in Max's primary recording via scripted-or-keyboard
   interaction mid-autopilot: HUD returns on each of the five
   triggers. Working-Claude documents the chosen trigger set in
   code comments and this brief is updated at Shipped if the
   set changed during implementation.

8. **Manual-override preserves ship angular momentum** (per
   `docs/FEATURES/autopilot.md` §"Manual override": *"Ship
   retains angular momentum (no snap-stop — inertial
   continuity)."* and §"Failure criteria": *"Manual override
   snap-stops the ship — inertial continuity violated."*).
   Verified in Max's primary recording: during autopilot CRUISE
   at visible speed, the player toggles off; the ship continues
   moving at approximately the same velocity; the player can
   reorient the camera freely while the ship coasts. No snap-
   stop; no camera cut. Diagnostic backup: ship velocity
   magnitude at toggle-off moment and +0.5s moment are within
   95% of each other (accounts for whatever small damping the
   manual mode applies; gives a clear fail signal if velocity
   drops to near zero).

9. **Manual-override burn routes through WS 1's navigation
   subsystem** (per `docs/SYSTEM_CONTRACTS.md` §10.3: *"manual-
   mode 'burn to body' uses the **same navigation subsystem**
   autopilot uses. Autopilot-off does not kill the navigation
   subsystem; it swaps the caller from cinematography-
   orchestrator to direct-user-command."*). Verified by code
   read: the manual-burn call site in `src/main.js` (post-WS-1
   path) imports the navigation subsystem module directly and
   calls its motion-execution API. The cinematography layer is
   NOT invoked. Verified in Max's recording: after toggle-off
   and a target-click + burn-commit, the ship accelerates
   toward the selected body with the same motion feel as
   autopilot-driven motion (because it's the same subsystem).
   Critically: the burn completing does NOT re-engage autopilot
   (per AC #5's explicit-only rule).

10. **Warp-select handoff at tour-complete honors HUD policy**
    (per `docs/FEATURES/autopilot.md` §"End-state + next-system
    loop" Director note). The feature doc presents three valid
    resolutions: (a) warp-select shows through HUD-hide with a
    small indicator; (b) tour-complete is itself a "player
    interaction" event that restores HUD; (c) autopilot auto-
    initiates next warp after a beat if player hasn't acted.
    **This workstream pins resolution (b):** tour-complete is
    the interaction event that restores HUD; the warp-select
    menu appears as part of HUD-restore. Rationale: (a)
    requires authoring a custom "through-HUD-hide" rendering
    layer for one menu, which is scope creep; (c) removes
    player agency at the most meaningful decision point (which
    star next?), which contradicts the feature doc's
    §"Heart's desire" language about the player trusting the
    tour. **Resolution (b) is pinned here with Director
    audit room to revisit.** Verified in Max's primary
    recording: tour-complete fires, HUD reappears (including
    warp-select menu), player picks a star, warp engages.
    **Open challenge — see §Drift risks.**

11. **Warp-select picks a star → warp begins → new system →
    autopilot re-engages on warp-exit** — the end-to-end loop
    per `docs/FEATURES/autopilot.md` §"End-state." Verified in
    Max's primary recording (or a companion second-system
    recording if the primary runs long): the full loop completes
    — tour at system A, warp-select, warp to system B, autopilot
    ENTRY at system B, tour at system B. This is the first
    recording in the game's history that shows the complete
    "autopilot is the game's mode" experience end-to-end.

12. **Audio event surface exists and emits** per §10.7. Three
    typed events: `phase-change`, `camera-mode-change`, `toggle`.
    V1 emits; **V1 has zero subscribers inside the codebase**
    (per §10.7 scope-creep guard). Verified by: (a) code read —
    three `emit(...)` call sites exist at the right transition
    points (phase-change from WS 2's choreographer; camera-mode-
    change from WS 3's dispatcher; toggle from this workstream's
    toggle handler); (b) grep for `autopilotEvents.on(` — returns
    **zero results** (no subscribers in V1). If there's a
    subscriber, someone built BGM modulation or similar inside
    this workstream, which is scope creep.

13. **Existing toggle SFX stay on their current code path** (per
    feature doc §"Audio": *"existing audio system stays … Toggle
    sound effects stay."*). Verified by code read: the existing
    toggle SFX trigger is not moved onto the new event-surface
    in V1. V-later reconsiders.

14. **Motion evidence at integration-gate** — **one primary
    canvas recording of the end-to-end flow: warp-exit → autopilot
    tour (multiple bodies) → toggle-off mid-tour → manual burn to
    a different body → toggle back on → tour completes → warp-
    select → warp → new system → autopilot resumes.** Per
    `docs/MAX_RECORDING_PROTOCOL.md` §"Capture path — canvas
    features (default)". 60–120 s — the richest recording across
    the four autopilot workstreams. Drop path:
    `screenshots/max-recordings/autopilot-toggle-ui-and-warp-select-2026-04-20.webm`.
    ACs #1–#11 evaluated against this recording; ACs #12–#13 are
    code-read rather than recording-visible.

    Per the Shipped-gate protocol: working-Claude closes at
    `VERIFIED_PENDING_MAX <commit-sha>` after the commit(s) land
    and the recording is on disk. Shipped flips on Max's verdict
    against the recording. Max is the evaluator of "does this
    feel like a mode I trust."

15. **Ship motion (WS 2) and camera dispatch (WS 3) unchanged in
    behavior.** The wiring in this workstream reads from the
    existing subsystems; it does not rewrite them. Verified by
    `git diff` on WS 2's ship choreographer and WS 3's camera
    dispatcher — only event-emission `emit(...)` lines may be
    added (per AC #12), no logic changes. If this workstream
    needs to change ship motion or camera logic, the scoping
    is wrong — escalate.

16. **Separable commits.** (a) Status indicator + `Tab` keybind +
    default-ON + no-auto-resume in one commit
    (`feat(autopilot): toggle UI + Tab keybind + default-ON + no-
    auto-resume`); (b) HUD hide/reappear policy in a separate
    commit (`feat(autopilot): HUD hide-during-autopilot + reappear-
    on-interaction`); (c) manual-override wiring (inertial
    continuity + subsystem-routed burn) in a separate commit
    (`feat(autopilot): manual-override routed through navigation
    subsystem`); (d) warp-select handoff in a separate commit
    (`feat(autopilot): warp-select integration at tour-complete`);
    (e) audio event surface in a separate commit
    (`feat(autopilot): audio event-surface hook (V1 — zero
    subscribers)`). No omnibus "V1 autopilot done" commit. Each
    commit names the AC(s) it closes and cites this brief.
    Stage only specific files touched — never `git add -A`.

## Principles that apply

Four of the six from `docs/GAME_BIBLE.md` §11 are load-bearing.
Principle 3 (Per-Object Retro Aesthetic) is orthogonal to wiring
work; Principle 4 (BPM-Synced Animation) is V-later.

- **Principle 2 — No Tack-On Systems.** Headline principle for
  this workstream. The manual-override path is the primary test;
  the warp-select integration is the secondary test; the audio
  event surface is the tertiary test. *Violation in this
  workstream would look like:* manual-override implemented as
  "disable autopilot and turn the ship's steering back on in
  `main.js` directly, re-inventing motion execution outside WS 1's
  subsystem" — that's a tack-on that reverses WS 1's split.
  *Or:* warp-select implemented as a custom HUD overlay that
  bypasses the HUD-hide system — that's a tack-on that reverses
  §10.6's invariant. *Or:* audio event surface with a V1
  subscriber already hooked up — that's scope creep (V-later
  subscribes; V1 emits only).

- **Principle 6 — First Principles Over Patches.** Retiring
  idle-auto-resume is this principle made visible. The existing
  30s-idle-pattern is the patch; the explicit toggle model is
  the first-principles move. *Violation in this workstream
  would look like:* leaving the 30s-idle-resume code path in
  place "as a fallback" for players who turn autopilot off and
  forget it. That's exactly the patch being retired; if the UX
  research later shows players need a fallback, it's a new
  first-principles design (perhaps "autopilot auto-re-engages
  at tour-complete after 10s" or similar), not the old patch
  reinstated.

- **Principle 5 — Model Produces → Pipeline Carries → Renderer
  Consumes.** The toggle UI, status indicator, and HUD policy are
  renderer concerns reading pipeline state (autopilot engaged /
  manual / warp). The audio event surface is the pipeline
  emitting outward; nothing consumes in V1. *Violation in this
  workstream would look like:* the status indicator writing into
  autopilot internal state ("click this to force ship to begin
  STATION"). The indicator reads the drive-state and clicks
  trigger the toggle handler; the toggle handler is the one
  path that mutates drive-state.

- **Principle 1 — Hash Grid Authority** (diagnostic, not
  central). The manual-override path selects a target via the
  existing reticle system (§5.4), which already reads from the
  hash grid. Nothing new here — this workstream consumes the
  selection; it doesn't re-implement body-picking.

## Drift risks

- **Risk: Manual-override burn routes through the cinematography
  layer because "the tour queue already knows how to go to a
  body."** The seductive version: the autopilot tour already
  goes to bodies; the manual-burn is "just" firing the same
  tour mechanism at the player's selection. Result: autopilot
  re-engages as a side effect of the burn completing (tour-
  stop-complete callbacks fire), violating AC #5's explicit-
  only rule.
  **Why it happens:** the cinematography layer has a
  `goToBody(body)` surface (from WS 1's slimmed module); reusing
  it is the shortest code path.
  **Guard:** AC #9 requires the manual-burn call site to import
  the navigation subsystem module directly and invoke its
  motion-execution API — NOT the cinematography layer.
  Verified by code read: no references to the cinematography
  layer's queue or orchestration methods from the manual-burn
  path. The subsystem knows how to accelerate from A to a
  stable orbit around B; that's what manual-burn needs. The
  cinematography layer adds tour-queue logic that manual-burn
  must NOT inherit.

- **Risk: HUD reappear triggers are too aggressive — any micro-
  cursor-motion unhides.** The cinematic frame is fragile. If
  a trembling cursor or an accidental mouse bump unhides the
  HUD during a STATION moment, the cinematic hold is broken.
  **Why it happens:** "any cursor motion" is the simplest
  trigger to implement.
  **Guard:** AC #7's trigger list specifies *"cursor motion to
  a selectable body"* — meaning the reticle has engaged a
  hover-target. Bare cursor motion does NOT unhide; cursor
  motion that CHANGES hover-target to a selectable body does.
  Working-Claude pins this in the code; the exact threshold
  (how long hovering a body before HUD unhides? or immediate?)
  is a tuning choice documented in the commit.

- **Risk: HUD reappear triggers are too conservative — the
  player clicks through nothing.** Inverse of above. If the
  triggers require an explicit keybind or menu-open, a player
  can click on a body and not know selection is happening
  because the HUD never came back.
  **Why it happens:** over-correcting for the aggressive case.
  **Guard:** AC #7's trigger list names four specific classes;
  the reticle-hover class IS a trigger. Max can tune during
  the recording review; working-Claude surfaces the chosen
  trigger set in the commit so Max can point at specific
  behaviors to adjust.

- **Risk: Warp-select handoff chosen resolution (b) "tour-
  complete restores HUD" breaks the cinematic flow.** Max
  invited challenge on this decision in the feature doc. The
  risk: after a long composed cinematic tour, the HUD slamming
  back on at tour-complete reads as abrupt — a hard cut from
  cinema to UI chrome.
  **Why it happens:** "HUD reappears" defaults to an instant
  transition.
  **Resolution:** resolution (b) is pinned in AC #10, but the
  HUD reappear at tour-complete is NOT instant — it's a faded-
  in reappear with the warp-select menu as the composition.
  Specifically: tour-complete fires → audio event `toggle`
  emits → camera holds a composed "arrived at tour-end"
  frame for ~1.5s → HUD fades in (with the warp-select menu
  as its primary element) → player interacts or holds. This
  is a tuning detail that falls out of the resolution, not a
  separate AC — working-Claude implements the fade and
  documents the timing. If Max reviews and the fade reads as
  wrong, tune.
  **Challenge raised in this brief per Max's invitation:** is
  resolution (b) the right pin? The counterfactual is (c):
  autopilot auto-initiates the next warp after a beat,
  removing the warp-select menu from the cinematic frame
  entirely. **PM position:** (c) removes the most meaningful
  decision the player makes (which star to warp to) and makes
  the tour feel like an attraction ride rather than a trip
  the player authors. The feature doc §"Heart's desire"
  language (*"Wonder and interest. Like a human navigator +
  cinematographer taking viewers on a tour"*) implies the
  player IS the navigator — the cinematographer is the
  autopilot, but navigation (which star next) is the player.
  So (b) with a careful fade is the right pin. **Director
  audit welcome;** Max breaks the tie if Director disagrees.

- **Risk: Audio event surface accidentally wires a subscriber
  in V1** because "existing toggle SFX should use the new
  event surface." Scope creep per §10.7.
  **Why it happens:** the new event surface LOOKS like the
  right abstraction for existing SFX; the migration feels
  like housekeeping.
  **Guard:** AC #13 explicitly preserves existing SFX on
  their current path. AC #12's verification greps for
  zero `autopilotEvents.on(` subscribers. If a subscriber
  is present, scope-creep has happened.

- **Risk: Idle-auto-resume re-introduced by accident when
  fixing an edge case.** Working-Claude encounters a scenario
  (e.g., player toggles off mid-warp, warp-exit happens,
  autopilot is still off) and "fixes" it by adding an
  auto-resume-on-warp-exit code path. That's a variant of
  idle-auto-resume and violates §10.4.
  **Why it happens:** edge cases feel like they need special
  handling; explicit-only can feel rigid.
  **Guard:** AC #5 is explicit. The ONLY paths that re-engage
  autopilot are (a) default-ON at system-load (§10.4) and (b)
  explicit click/Tab. Warp-exit is a system-load from
  autopilot's perspective (per §10.5 — ENTRY is the handoff);
  if the player toggled off before warp, the toggle-off
  state persists into the new system. That's the intended
  design: a player who explicitly disengaged autopilot is
  disengaged until they explicitly re-engage.

- **Risk: `Tab` keybind silently swallows the existing next-
  planet cycler behavior with no user-visible signal.** The
  feature doc §"Keybinding" names this overlap explicitly as
  Max's accepted cost, but if the transition is invisible
  (`Tab` just starts toggling autopilot with no dev-mode
  warning or changelog), the user experience is confusing.
  **Why it happens:** the keybind handler just points Tab
  elsewhere; no communication happens.
  **Guard:** working-Claude documents the conflict in the
  code comment at the Tab handler AND in the commit message.
  Per feature doc §"Keybinding" explicitly: *"Honest naming
  in this doc. Don't hide the conflict at code-time."*

- **Risk: Manual-override camera unlock implemented as
  "reset the camera to identity pose."** The feature doc
  requires inertial continuity + free camera reorientation.
  If the toggle-off handler resets the camera pose to some
  neutral state, continuity is broken (camera jumps) AND the
  player can't reorient freely (they're dropped into a fixed
  state, not a free state).
  **Why it happens:** "clear ESTABLISHING's state" is the
  simplest way to implement mode-exit, but it conflates
  state-clear with pose-clear.
  **Guard:** AC #8's diagnostic backup requires velocity
  continuity at toggle-off; the camera equivalent is
  pose-continuity (camera pose at toggle-off ≈ camera pose
  at +0.1s, modulo the player's own input). Working-Claude
  implements toggle-off as: (1) stop ESTABLISHING's pacing
  envelope (the linger/pan timers stop advancing); (2) the
  camera's current pose is the starting pose for manual
  mode; (3) player input deltas drive camera orientation
  from there. No pose reset.

- **Risk: Warp-select menu invocation uses the cinematography
  layer rather than the existing warp-select code path.**
  The feature doc §"End-state" says *"existing warp-selection
  logic presents next-star options."* Reusing the EXISTING
  mechanism is the rule. If working-Claude re-writes warp-
  select as part of this handoff, scope has inflated.
  **Why it happens:** integrating with the existing
  warp-select code might surface some awkwardness (e.g., the
  existing logic assumes HUD is visible; this workstream is
  in an HUD-hide context). Rewriting looks cleaner.
  **Guard:** the existing warp-select path is preserved
  verbatim. This workstream wires "tour-complete → trigger
  existing warp-select" and trusts the existing logic to
  present options. Any changes needed in the warp-select
  code itself are a followup, not this workstream.

## In scope

- **Upper-left status indicator** — new DOM/canvas element (TBD
  by working-Claude, consistent with existing HUD rendering
  approach). Two visual states (on/off). Clickable — click
  fires toggle handler. Remains visible during HUD-hide per
  §10.6 exception.

- **`Tab` keybind** at a new handler in `src/main.js`
  alongside (displacing) the existing next-planet-cycler at
  `src/main.js:6076` / `:6120`. Working-Claude documents the
  displacement in the code comment. Does NOT remove or redesign
  the cycler logic — that's the keyboard-shortcut-redesign
  workstream.

- **Default-ON wiring** at system-load. Autopilot's drive-state
  transitions to `Autopilot` mode when the player enters a
  system (warp-exit or debug-shortcut). No player action
  required to engage. Existing ShipCameraSystem idle-auto-resume
  path is REMOVED in this workstream.

- **Retirement of idle-auto-resume** — remove the 30s-idle-
  resume code path from `ShipCameraSystem` or wherever it
  currently lives. Replace with explicit-only transitions.
  AC #5 is the grep-verifiable hard constraint.

- **HUD hide-on-autopilot-engage** — on transition to
  `Autopilot` mode, general HUD elements (reticle HUD, target
  info panel, nav readouts — working-Claude enumerates
  during implementation) hide. Status indicator remains.

- **HUD reappear-on-interaction triggers** per AC #7's V1
  trigger list: (a) cursor motion to selectable body (reticle
  hover engaged); (b) keyboard input mapping to an in-game
  action; (c) commitSelection event; (d) menu-open. Working-
  Claude implements the trigger set and documents in code.

- **Manual-override path:**
  - Toggle-off preserves ship angular momentum (no velocity
    zero-out).
  - Toggle-off unlocks camera from ESTABLISHING's pacing
    envelope; camera pose at toggle-off is the starting pose
    for manual.
  - Player input (WASD / mouse) drives ship + camera directly.
  - Target-select via existing reticle path (`commitSelection`).
  - Burn-commit via existing path (`commitBurn`), but the
    burn-execution call site is rewritten to invoke WS 1's
    navigation subsystem DIRECTLY — no cinematography layer.
  - Burn completing does NOT re-engage autopilot.

- **Warp-select handoff at tour-complete:** tour-complete
  event (emitted by cinematography layer when queue exhausts)
  → ~1.5s composed "arrived" hold → HUD fade-in with warp-
  select menu as primary element (resolution (b) per AC #10)
  → player picks star → existing warp flow begins. The
  existing warp-select logic is called from this workstream's
  handler; warp-select itself is unchanged.

- **Audio event-surface hook** per §10.7. Three typed events:
  - `autopilotEvents.emit('phase-change', ...)` — emitted by
    WS 2's ship choreographer when ship-phase transitions.
    Working-Claude adds the emit line to WS 2's module in
    this workstream (per AC #15, only `emit(...)` additions
    to WS 2's module are allowed).
  - `autopilotEvents.emit('camera-mode-change', ...)` —
    emitted by WS 3's camera dispatcher when `setMode()` is
    called with a different mode. Working-Claude adds the
    emit line to WS 3's module. V1 never changes camera mode
    in normal operation, so this emit fires only on dev-
    triggered mode changes.
  - `autopilotEvents.emit('toggle', ...)` — emitted by this
    workstream's toggle handler.
  - **Zero subscribers in V1.** `autopilotEvents.on(...)`
    appears nowhere in the codebase at V1 close.

- **Existing toggle SFX preserved** on current path. Not
  migrated to the new event surface in V1.

- **Primary canvas recording** (end-to-end flow) per AC #14.
  Drop path:
  `screenshots/max-recordings/autopilot-toggle-ui-and-warp-select-2026-04-20.webm`.
  60–120 s. Captured via `~/.claude/helpers/canvas-recorder.js`
  + `~/.local/bin/fetch-canvas-recording.sh`. This is the
  richest recording in the four-workstream sequence — it's
  the acceptance artifact for "V1 autopilot shipped."

- **Contact sheets** for phase-transition and interaction moments
  via `~/.local/bin/contact-sheet.sh`. Working-Claude highlights
  specific timestamps for Max: autopilot-engage at warp-exit,
  HUD hide moment, toggle-off moment (velocity continuity),
  manual-burn commit, tour-complete fade, warp-select menu
  appear, warp engage, new-system autopilot-engage.

- **Commits per AC #16** — five separable commits, each
  naming the AC(s) it closes.

- **`## Status` line in this brief** flipped from "Scoped" →
  `VERIFIED_PENDING_MAX <sha-list>` → `Shipped <sha-list> —
  verified against <recording-path>` per protocol.

## Out of scope

- **Keyboard-shortcut redesign** — the durable resolution of
  the `Tab` / next-planet-cycler conflict. Feature doc
  §"Keybinding" makes this a separate GTD task; §10.4.1
  codifies that a future binding change is not a contract
  violation. This workstream DOES NOT touch the existing
  cycler at `src/main.js:6076`/`:6120`, DOES NOT touch `1-9`
  planet jumps, DOES NOT move the settings-panel `P` binding
  (`src/main.js:5738`). It only wires `Tab` for autopilot,
  accepting the cycler overlap.

- **Warp-select UI redesign.** The existing warp-selection
  logic is called as-is at tour-complete. If the existing
  logic has its own issues (look, feel, flow), those are a
  separate workstream. This brief's §"Warp-select handoff"
  just wires the trigger.

- **BGM modulation subscriber.** V1 emits; V-later subscribes.
  Feature doc §"Audio" and §10.7 explicit.

- **Ship motion changes, camera dispatch changes.** AC #15 is
  the guard. Only event-emit additions may be made to WS 2
  and WS 3 modules.

- **New manual-mode-specific camera behavior.** Manual mode's
  camera is "unlocked from ESTABLISHING + player input drives
  pose." This workstream does NOT author a new camera mode
  for manual flight. If manual-mode camera feels wrong in the
  recording, that's tuning on the player-input → camera-pose
  responsiveness, not a new mode.

- **HUD element redesign.** The HUD elements that hide / reappear
  are the ones that exist today. No new HUD elements beyond the
  status indicator. If the existing reticle HUD feels cluttered
  or the target info panel needs rethink, that's separate work.

- **Tour-complete cinematic beat authoring beyond the 1.5s
  composed hold.** The feature doc names tour-complete as a
  valid cinematic moment; working-Claude implements a minimal
  composed hold (camera holds the current subject, ship
  decelerates to station-equivalent velocity, HUD fades in
  with warp-select). A richer authored tour-complete moment
  is V-later.

- **Haptic / controller feedback on toggle, HUD appear, etc.**
  Out of scope; no controller integration in V1.

- **Multi-frame warp-select composition integration** — e.g.
  rendering the warp-select menu AS the cinematic frame rather
  than as an HUD overlay. That's resolution (a) from feature
  doc §"End-state," which this workstream rejects in favor of
  resolution (b). Reopening that design is a future PM pass.

- **Analytics / event logging on autopilot state changes.** The
  audio event surface is for audio; analytics is a separate
  concern.

## Handoff to working-Claude

Read this brief first. Then, in order:

1. **`docs/FEATURES/autopilot.md` in full**, especially
   §"Trigger / toggle / UI (V1)", §"Keybinding (provisional)",
   §"End-state + next-system loop" (the Director's challenge
   note Max invited), §"Manual override — two-layer
   architecture", §"HUD", §"Audio", §"Failure criteria /
   broken states", §"Drift risks."

2. **`docs/SYSTEM_CONTRACTS.md` §10 in full**, especially §10.3
   (two-layer architecture — manual-override routing), §10.4
   (drive-state transitions + idle-auto-resume retirement),
   §10.4.1 (keybinding), §10.6 (HUD), §10.7 (audio event
   surface), §10.10 (contract precedence).

3. **`docs/SYSTEM_CONTRACTS.md` §5.3 Drive States + §5.4
   In-System Targeting** — the Manual / Autopilot / Warp
   drive-state matrix and the reticle-select-commit path
   manual-override consumes.

4. **`docs/WORKSTREAMS/autopilot-navigation-subsystem-split-2026-04-20.md`**
   (WS 1, shipped `656ded3`) — the navigation subsystem API
   manual-override routes through. Read the module header +
   motion-execution API.

5. **`docs/WORKSTREAMS/autopilot-ship-axis-motion-2026-04-20.md`**
   (WS 2, shipped `2be6f37`) — the ship choreographer this
   workstream adds `phase-change` event emission to. Read
   where the ship-phase transitions happen; that's where the
   emit lines go.

6. **`docs/WORKSTREAMS/autopilot-camera-establishing-2026-04-20.md`**
   (WS 3, pending) — the camera dispatcher this workstream
   adds `camera-mode-change` event emission to. Read where
   `setMode()` is called; that's where the emit line goes.

7. **`src/main.js`** — especially the sections WS 1 and WS 2
   modified:
   - Autopilot pick-up sites (post-WS-1 path).
   - Manual burn sites (post-WS-1 path — now routed through
     subsystem).
   - The `Tab` keybind handler at `src/main.js:6076` / `:6120`
     (next-planet cycler) — READ-ONLY reference; this
     workstream displaces it by adding a new `Tab` → autopilot
     handler, not by editing the cycler.
   - The `P` keybind at `src/main.js:5738` (settings panel) —
     READ-ONLY; confirming the binding is still there.
   - Existing HUD element definitions and the ShipCameraSystem
     idle-auto-resume path (TO BE REMOVED per AC #5).

8. **`docs/MAX_RECORDING_PROTOCOL.md` §"Capture path — canvas
   features (default)"** — the recording workflow for AC #14.

9. **`feedback_motion-evidence-for-motion-features.md`** — the
   cross-project principle for phased-experience Shipped gates.

10. **`feedback_always-test-sol.md`** — Sol as the primary
    recording target for the first-system portion.

11. **`feedback_test-actual-user-flow.md`** — the recording
    must use real keyboard + click input, not synthetic
    entry points like `window._autopilot.toggle()`. The state
    machine that this workstream wires is exactly the
    code path that synthetic entry bypasses.

12. **`feedback_prefer-chrome-devtools.md`** — `mcp__chrome-devtools__*`
    for intra-session sanity checks, NOT Playwright.

Then, in order of execution:

1. **Design the status indicator + toggle handler** — draft the
   indicator's DOM shape (or canvas-rendered shape, consistent
   with existing HUD approach) and the toggle handler's state
   machine (autopilot → manual via click/Tab/WASD; manual →
   autopilot via click/Tab only). Surface in chat + sanity-check
   against §10.4 before implementing.

2. **Implement status indicator + `Tab` keybind + default-ON
   + idle-auto-resume retirement.** AC #1, #2, #3, #4, #5. The
   removal of idle-auto-resume is the load-bearing change here
   — grep for the 30s-idle pattern after implementation.

3. **Implement HUD hide-during-autopilot + reappear-on-
   interaction.** AC #6, #7. Enumerate HUD elements hidden;
   document the reappear trigger set in code comments.

4. **Implement manual-override path** — toggle-off handler
   preserving angular momentum + camera pose; manual-burn
   call site rewritten to invoke WS 1's subsystem directly.
   AC #8, #9. Verify by grep: the manual-burn call site
   does not reference cinematography-layer symbols.

5. **Implement warp-select handoff at tour-complete** —
   tour-complete handler: composed hold (~1.5s) → HUD fade-in
   → existing warp-select invoked. AC #10. The 1.5s timing
   is tuning; Max reviews in the recording.

6. **Wire the full loop: new-system autopilot re-engage** on
   warp-exit. AC #11. Confirm the default-ON path (step 2)
   triggers on warp-exit as well as initial system-load.

7. **Implement audio event surface** — three typed events.
   Add emit lines to WS 2's choreographer (phase-change), WS
   3's dispatcher (camera-mode-change), and this workstream's
   toggle handler (toggle). Confirm zero subscribers via grep.
   AC #12, #13.

8. **Intra-session sanity checks via `mcp__chrome-devtools__*`**
   — exercise the full flow: Sol dev-shortcut, autopilot
   engages default-ON, tour runs, toggle-off, manual-burn,
   toggle-on, tour-complete, warp-select, warp, new system
   auto-engage. Screenshot at each interaction for a PW-style
   self-audit before committing.

9. **Capture the primary recording** per AC #14 — 60–120 s of
   the full end-to-end loop. This is the richest recording
   in the four-workstream sequence; budget time for the
   capture and be ready to re-take if any segment reads wrong.

10. **Surface contact sheets** for Max with the specific
    interaction timestamps highlighted (autopilot-engage,
    HUD-hide, toggle-off, manual-burn, tour-complete, warp-
    select, warp-engage, new-system autopilot-engage).

11. **Commit per AC #16** — five separable commits, each
    naming the AC it closes. Stage only specific files
    touched — never `git add -A`.

12. **Close at `VERIFIED_PENDING_MAX <sha-list>`.** Max
    evaluates against the recording. On pass → `Shipped
    <sha-list>`; on fail → diagnose per the failure class
    (snap-stop on toggle-off = velocity preservation broken
    in toggle handler / autopilot re-engages after burn =
    tour-queue side effect leaking into manual path / HUD
    stays during cinematic = hide trigger broken / warp-
    select feels abrupt at tour-complete = fade timing too
    fast, tune the 1.5s hold).

**If the manual-burn path reaches the cinematography layer,
stop — that's the tack-on anti-pattern WS 1 was written to
prevent.** AC #9 is the grep-verifiable hard constraint.

**If `autopilotEvents.on(...)` appears anywhere in the codebase
at this workstream's close, V1 has a subscriber — scope has
crept per §10.7.** Remove it; that's V-later's job.

**If idle-auto-resume is still in the code (even "just as a
fallback"), AC #5 fails.** The pattern is retired. If a genuine
need for a fallback emerges during testing, escalate — a new
first-principles design, not the retired patch.

**If the `Tab` keybind breaks the next-planet-cycler in a way
that causes in-game confusion Max hadn't anticipated, escalate**
— the feature doc §"Keybinding" accepted the overlap but
accepted it temporarily with the understanding it's displacing,
not deleting. If Max's lived experience with the displacement is
worse than expected, the keyboard-shortcut-redesign GTD task
jumps in priority.

**On the warp-select resolution (b) challenge (§Drift risks):**
if Max reads the primary recording and decides resolution (b)
is wrong, working-Claude diagnoses which alternative fits
better — (a) custom through-HUD-hide overlay for warp-select,
or (c) autopilot auto-initiates after a beat. (a) is a new
rendering layer (likely a followup workstream); (c) is a
simple timer + auto-action inside this workstream. Either
way, the Director audits the pivot before working-Claude
ships the alternative.

Artifacts expected at close: 4–5 commits (indicator + keybind
+ default-ON + no-auto-resume; HUD; manual-override; warp-
select handoff; audio event surface — separable per AC #16);
one primary canvas recording at the path in AC #14; this brief
at Shipped with commit SHAs + recording path cited; any
followups (keyboard-shortcut redesign, warp-select UI rethink,
tour-complete authored cinematic beat) recorded in §Followups
(if added).

## Sequencing across the four V1 autopilot workstreams

Full V1 autopilot delivery is four workstreams. The recommended
default execution order is **sequential**:

1. **WS 1 — `autopilot-navigation-subsystem-split-2026-04-20.md`**
   (shipped 2026-04-20 at commit `656ded3`). Separates the
   navigation subsystem (motion execution) from the
   cinematography layer (tour orchestration). Prerequisite for
   manual-override in this workstream and for everything else.
2. **WS 2 — `autopilot-ship-axis-motion-2026-04-20.md`** (shipped
   2026-04-20 at commit `2be6f37`). Authored ship motion through
   ENTRY / CRUISE / APPROACH / STATION; gravity-drive shake
   mechanism; warp-exit handoff. Camera held in debug follow-
   mode during this workstream. This workstream adds the
   `phase-change` event emission to WS 2's choreographer.
3. **WS 3 — `autopilot-camera-establishing-2026-04-20.md`**
   (pending). Retires `FlythroughCamera.State`, lands the two-
   axis camera dispatcher, implements ESTABLISHING. This
   workstream adds the `camera-mode-change` event emission to
   WS 3's dispatcher.
4. **WS 4 — THIS WORKSTREAM.** Toggle UI, keybind, HUD policy,
   manual-override routed through WS 1's subsystem, warp-select
   handoff, audio event surface. Consumes the full-stack
   behavior WS 1–3 produced as its end-to-end recording target.

**Parallel option (WS 2 + WS 3):** considered and rejected in
the WS 3 brief's §"Sequencing." See that section for the
reasoning. WS 4 cannot run in parallel with any of WS 1–3
because it consumes all three outputs end-to-end in its
acceptance recording.

**Lock sequential.** The end-to-end recording at AC #14 is the
shipped-gate artifact for V1 autopilot as a whole; sequential
execution guarantees that recording is meaningful.

## See also

- `docs/FEATURES/autopilot.md` — parent feature.
- `docs/SYSTEM_CONTRACTS.md` §10 — autopilot invariants.
- `docs/WORKSTREAMS/autopilot-navigation-subsystem-split-2026-04-20.md`
  (WS 1, shipped `656ded3`) — navigation subsystem manual-
  override routes through.
- `docs/WORKSTREAMS/autopilot-ship-axis-motion-2026-04-20.md`
  (WS 2, shipped `2be6f37`) — ship motion whose phase
  transitions emit `phase-change`.
- `docs/WORKSTREAMS/autopilot-camera-establishing-2026-04-20.md`
  (WS 3, pending) — camera dispatcher whose mode changes
  emit `camera-mode-change`.
- `docs/MAX_RECORDING_PROTOCOL.md` — canvas-path capture
  workflow for AC #14.
- `feedback_motion-evidence-for-motion-features.md` — motion
  evidence principle.
- `feedback_test-actual-user-flow.md` — real keyboard + click
  input for the recording, not synthetic entry.

## Open questions for Max

Two questions surfaced during PM authoring that deserve Max's
attention before working-Claude ships:

1. **Warp-select resolution (b) pinned in AC #10.** Max
   invited challenge on this decision; PM position argued for
   (b) on player-agency grounds. The pinned resolution will
   ship unless Max or Director disagrees. See §Drift risks
   entry on warp-select for the full reasoning.
2. **HUD reappear trigger set (AC #7).** The feature doc left
   this soft; this brief pins four triggers (reticle-hover-to-
   selectable-body; in-game-mapped keyboard input;
   commitSelection; menu-open). Working-Claude implements this
   set; Max tunes during recording review. Calling it out
   here so the tuning isn't a surprise.
