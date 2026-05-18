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
- Nav computer: column view bugs; mid-zoom level needs resolution-aware
  detail (unsolved design problem)
- Galaxy rendering: angular artifacts, artificial-looking bar, uniform
  glow color

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
