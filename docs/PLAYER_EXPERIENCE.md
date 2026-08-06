# Player Experience — Well Dipper

**Decay:** Medium. Updated when shipped experience evolves vs spec
(bound to Tester PASS-on-Shipped ritual per Rule 3).
**Audience:** Director + UAT.
**Status:** v5 migration skeleton — extracted from archived Game Bible
§1A + intake. **Max to review and finalize per-tier Target/Anti-experience
sections.**

Per-mode experience targets. Each tier has Target experience (what we're
trying to achieve) + Anti-experience (what must NEVER happen). UAT
verdicts measure against these.

---

## SCREENSAVER tier (F&F MVP target)

**Frame:** Viewer, not player. Passive observation. The "viewer" may be
Max, friends, family — running this on a second monitor or as a
contemplative background.

### Target experience

- **Drift feels gentle and continuous.** Camera moves at a pace where
  individual frame changes are imperceptible — motion is felt, not
  observed.
- **Each system arrival is fresh.** The procedural generator produces
  visually distinct experiences without obvious repetition.
- **The warp is a moment.** Pressing spacebar (or autopilot triggering)
  → meaningful build-up → tunnel traversal → arrival. The transition
  feels worth waiting for, not a loading screen to skip.
- **Surface complexity reads from distance.** Looking at a planet from
  cruise altitude, you can tell it's a gas giant vs a terrestrial vs
  exotic vs civilized at a glance.
- **Max would be proud to leave this running.** No defects that pull
  attention away from the experience during a 10-minute observation.

### Anti-experience

- **No catalog-of-defects feel.** No ghosting reticles, no persisting
  landing strips, no mid-warp freezes, no tunnel-second-half blackouts,
  no abrupt color/lighting changes, no UI elements appearing/disappearing
  during transitions.
- **No jank during transitions.** Warp opening, tunnel traversal, exit,
  and arrival all flow without visible discontinuities.
- **No "obviously placeholder" visuals during default play.** SFX,
  music, and rendering should not call attention to themselves as
  unfinished. (Note: many visuals ARE placeholder per intake; F&F MVP
  requires polish pass before this gate is met.)
- **No "where am I" disorientation.** Even passive viewers should
  always have a sense of being somewhere specific.

### Current state (intake 2026-05-18)

Per intake doc, screensaver is functionally running but multiple visible
defects remain. Tracked in FEATURES.md (Phase 5) under `F&F-MVP` tier.
Key gaps:
- Warp: 5 distinct broken pieces (opening, tunnel follows camera buggy,
  landing strip multiplies, exit broken, second half not rendering)
- All rendering: placeholder quality; visual pass needed for every type
- All SFX: placeholders made from title-theme clipping/pitch-shifting
- Nav computer: PRISM view bugs (renamed from COLUMN 2026-05-25); mid-zoom level needs resolution-aware
  detail (unsolved design problem)
- Galaxy rendering: angular artifacts, artificial-looking bar, uniform
  glow color

**Update 2026-06-28 — supercruise flight shipped (diverges from passive-screensaver spec):**
the F&F build now includes **hands-on HELM flight** (manual throttle + mouse
virtual-joystick + hold-to-look free-look) over the same supercruise model the
autopilot tour flies, deployed to master @ `09db316`. Two UAT behaviors corrected
this session (@ `f455f39`): in HELM hands-on the cursor is hidden and the mouse is
the flight stick, so **left-click selects the body under the center reticle** (your
nose), making planets/moons selectable rather than only background stars; and
forced-drop/mass-lock near a star is **direction-aware** — you can engage and fly
off when pointed away, while a head-on approach still drops you (capture). Sublight
maneuvering with a hard collision barrier (never fly through a body) shipped in the
same arc.

**Update 2026-08-01 — the ORRERY station shipped (a second, deliberately
non-screensaver way to be in the build):** where HELM diverged from the passive
spec by giving the player the stick, ORRERY diverges the other way — it is
god's-eye *viewing* in which **nothing ever flies you**. Entry is an instant
framed cut with no warp cinematic; the title-end and nebula-linger auto-warp
timers never fire, so ORRERY idles indefinitely; BURN never renders and no path
silently swaps you to HELM. Bodies are browsed by click-1 to select, click-2 to
glide the *view* (a two-phase centre-then-fly: rotate until the target is
centred, then translate straight in — never a side-slide). Warping between
systems arrives by zooming **in** from a far spawn rather than teleporting in and
zooming out, and D-hold at the chooser skips the whole boot ceremony straight
into Sol in either station.

Two consequences worth recording because they read as UX, not internals: orbit
lines are drawn by a screen-space conic field rather than per-ring geometry, so
they now survive being viewed edge-on (the old renderer painted nothing within
~6° of the orbit plane); and the camera-proximity fade is **retired** on Max's
2026-08-01 ruling — orbit lines no longer disappear as you approach a planet.
That fade was mitigation for a renderer that no longer exists, and its cutoff
scaled with the *orbit's* radius rather than the body being approached, so lines
vanished while the planet was still a dot.

Shipped on `feature/supercruise-freelook`, UAT-passed 2026-08-01, merged to
**local master only — not deployed**.

**Update 2026-08-01 — the HELM cockpit shipped, and it is the largest divergence
from the passive-screensaver spec so far:** in HELM you are now *inside the
ship*. A GLB cabin surrounds the view, and four glass panels carry live state —
NAV (the system/galaxy map), DRIVE (speed, throttle, mode), SURVEY (the body
you are looking at) and TARGET (name, distance, ETA). Max's gate for it was
whether it *"feels like flying from inside"*, and it passed on that wording.

The consequence worth writing down is subtractive: **the screen-space readouts
retire in HELM** rather than being drawn twice. The speed/throttle cluster, the
MODE line and the mass-lock warning are on the glass now, so the flat overlay
stops drawing them. That retirement is per-role and premise-based, not a blanket
"are we in HELM" — if the cabin fails to load, every retired overlay comes
straight back, because the premise "it is on the glass" is then false. This was
verified by moving the cabin asset aside on purpose rather than by argument.

Targeting reticles are cut by the cabin's real silhouette, so a reticle behind a
rib or a monitor arm is clipped at the actual edge rather than blinking out
whole. Panels repaint at 30 Hz — Max's pick from a live knob; the earlier 12.5 Hz
read as stale beside a ~235 Hz world, and the cost difference is under half a
millisecond.

Not yet done, and parked deliberately: the cabin casts no shadows (neither onto
itself nor from system objects), and the reticles are cut by the glass without
yet *looking* projected onto it — no canopy tint, glass-depth parallax or
phosphor. Both are in `PARKING_LOT.md` (P6, P4).

---

## ENRICHED tier (Layer 2)

**Frame:** Viewer, still passive. Same screensaver loop but visiting a
system reveals depth the MVP didn't show.

### Target experience

- **Depth is additive, not gating.** A system Max has seen 50 times
  reveals something new on visit 51 without breaking what was there.
- **Specific places feel specific.** Sol looks like Sol; Trappist-1
  looks like Trappist-1; named systems have bespoke detail.
- **Megastructures and environmental hazards add scale awareness.**
  Seeing a Dyson swarm or ring habitat communicates "this civilization
  is older / weirder / more advanced than yours."
- **Nebula presence is felt, not just observed.** Approaching a nebula
  changes what it feels like to be in the starfield. Inside a nebula,
  it dominates the field of view.

### Anti-experience

- **No "where did the screensaver go" disruption.** Layer 2 features
  must not require player input or save state.
- **No "checklist of overlays" feel.** Civilized + exotic + megastructures
  + environmental hazards should compose into "this system feels lived-in
  or weird," not "5 overlay flags are set."

### Current state

Per Bible §1A: ~5% done. Much exists in generators but doesn't reach a
shader (see archived FEATURE_AUDIT for variety/wiring census). Per
intake: some Layer-2 items will pull into F&F MVP — disposition during
Phase 5.

---

## GAME tier (Layer 3)

**Frame:** Player. Active engagement. Decisions, risk, reward,
consequence.

### Target experience

- **Player ship feels like a character.** Old, temperamental, superior
  in ways that matter — like inheriting a hand-built mechanical watch
  in a world of digital ones.
- **The scanner is the universal interaction verb.** 4 layers (galactic
  survey → star-wave → direct → codex) — every "I want to know about
  X" question routes through scanning.
- **Combat is tied to velocity.** Star Fox all-range mode at low speed,
  Panzer Dragoon on-rails at high speed. The mode you're in derives
  from how you're moving.
- **The warp is a place, not a transition.** [Late-game] Entering warp
  may yield encounters with impossible spaces, anomalies that don't
  follow physics, moments of profound strangeness.
- **A 10-minute play session feels like a game.** Decisions made,
  consequences encountered, progression visible.

### Anti-experience

- **No "screensaver with a HUD overlay" feel.** Game mode must be
  meaningfully different — engagement, decision-making, stakes.
- **No tutorial-driven onboarding.** Player's understanding deepens
  through experience.
- **No lore dumps.** What the warp "really is" is never explained.

### Current state

Per Bible §1A: ~3% done. Ship Scanner shipped 2026-05-09 as first
Layer-3-flavored capability (selectable + burnable vehicles). World-origin
rebasing is architectural prerequisite for ship-scale features
(archived as `PLAN_world-origin-rebasing_LEGACY.md`; ROADMAP to be
authored fresh in `SYSTEMS/world-coordinates/` when that system gets
its deep dive).

---

## How this doc relates to FEATURES.md

`FEATURES.md` is the row-by-row feature inventory with status. This doc
is the felt-experience target the inventory serves. When a feature
ships and the shipped experience differs from the spec described here,
per Rule 3 working-Claude updates this doc (or explicitly flags
divergence) before flipping `shipped-confirmed`.

---

**Source:** Authored 2026-05-18 by working-Claude as Phase 2 of v5
migration. Extracted from `ARCHIVE/GAME_BIBLE_LEGACY.md` §1A + intake.
**Max to review and refine.**
