# Glossary — Well Dipper

Project-specific terminology. In-fiction terms reference
`PILLARS.md` Key Fictions; technical/dev terms documented in full
here.

Grows over time. When a feature or system doc introduces a new term
not in this glossary, add it.

## In-fiction terms (lore — see PILLARS.md Key Fictions)

- **Hyperspace** — diegetic name for the warp tunnel mechanism. See
  `FEATURES/warp.md` (when authored).
- **Fold generator** — the ship's personal warp drive. The player
  carries one; most NPCs depend on stabilized warp gates.
- **Breakaway line** — the human civilization the player descends from;
  split from mainstream humanity ~1 millennia ago.
- **Sacred experience** — the design framing for the warp; not just
  travel, a moment outside space-time.

## Technical / dev terms

- **OOI** — Object Of Interest. The targetable-body abstraction
  (planets, moons, ships, megastructures). Inspection-layer category.
  See `SYSTEMS/objects-of-interest/` (when authored;
  `ARCHIVE/OBJECTS_OF_INTEREST_LEGACY.md` is reference material).
- **Burn to body** — autopilot mode that accelerates camera toward
  selected body via spherical-coord state in body's local frame.
- **Ship Scanner** — Alt-toggle mode (shipped 2026-05-09) that surfaces
  cyan reticles for ships. Click-select + burn-to-ship at 45° angular
  framing + ship-lock orbit mode.
- **Reticle** — 2D canvas overlay outside Three.js scene graph; renders
  bracket cursors for targetable bodies + ships.
- **Inspection layer** — `__wd.*` debug API surface; tagged scene
  inventory + predicate library + integration test runners.
- **OOI capture** — proposed Layer-2 mechanic for screensaver
  contemplative mode; not shipped.
- **Active workstream** — the workstream pointed to by
  `~/.claude/state/dev-collab/active-workstream.json` well-dipper key.
  Tester reads this for PASS scoping.

## Tier terminology

- **SCREENSAVER tier (F&F-MVP)** — passive observation, no player
  character. See `PLAYER_EXPERIENCE.md` SCREENSAVER.
- **ENRICHED tier (Layer 2)** — depth-additive enhancements; still
  passive. See `PLAYER_EXPERIENCE.md` ENRICHED.
- **GAME tier (Layer 3)** — playable; ship, scanner, combat, scanner,
  nav computer, fuel. See `PLAYER_EXPERIENCE.md` GAME.
- **F&F MVP** — Friends and Family Minimum Viable Product. The
  Director-defined ship target: screensaver mode functionally complete
  + no visible defects + ready to share with friends/family. NOT
  identical to Bible's "SCREENSAVER functionally complete" claim — F&F
  MVP requires Max-confirmed zero-visible-defects.

## Historical / deprecated terminology

- **Deep sky** — DEPRECATED gameplay term from first-month development.
  Originally referred to the dice-roll mechanic where random warps
  could land in nebulae or external galaxies. That mechanic is dead
  (per 2026-05-18 intake; procedural Milky Way model superseded it).
  The deep-sky **rendering code** survives serving only: title screen
  procedural background + debug mode gallery + planned Easter egg
  (warp to another galaxy → turn-back message; not yet shipped). See
  `SYSTEMS/deep-sky-rendering/` (when authored) for History note.
- **Director** — RETIRED Dev Collab OS persona (2026-04-25). Functions
  redistributed: PM owns brief context; Tester gates "done"; Max +
  working-Claude handle alignment audits directly. See
  `docs/PERSONAS/director.md` "Retirement notes."

## Workstream-status schema (FEATURES.md)

- `shipped-confirmed` — Max UAT pass; in production
- `shipped-code` — code in main; not Max-confirmed
- `verified-pending-max` — Tester PASS; awaiting Max UAT
- `in-flight` — active workstream
- `scoped` — PM brief exists, not started
- `proposed` — surfaced, unscoped
- `parked` — explicitly deferred (link to reason)
- `dead` — used to exist, removed (link to history)

## Tier schema (FEATURES.md)

- `F&F-MVP` — must ship before Friends & Family release
- `ENRICHED` — Layer 2; ship after F&F MVP
- `GAME` — Layer 3; long-horizon
- `unsure` — disposition needed (Max judgment)
