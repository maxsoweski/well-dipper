# Pillars — Well Dipper

**Decay:** Rare. Update only when the game's fundamental identity shifts.
**Audience:** Director. Anchors scope decisions.
**Status:** v5 migration skeleton — extracted from archived Game Bible
§1-2 + intake material. **Max to review and finalize Key Fictions +
Aesthetic sections.**

## Genre / shape

A retro space screensaver that doubles as an exploration game.

In **screensaver mode** you drift through vast, open, limitless
procedurally-generated space — drifting through gravity wells, watching
planets orbit, warping between systems. No player character, no
inventory, no combat.

In **game mode** (planned Layer 3) you pilot a ship through the same
universe — discovering, scanning, trading, fighting, refueling. The
vastness is always there, whether you're watching planets orbit or
dodging pirate fire.

The screensaver is the MVP. Game systems grow out of it.

**Name origin:** "Well Dipper" = dipping between gravity wells.

## Pillars

1. **Procedural Milky Way as the world.** Locations in the galaxy are
   generated from a mathematical seed; everything in the rendering and
   gameplay pipeline derives from that. The pre-2026-04 dice-roll
   mechanic (random chance of arriving in a nebula/galaxy) is dead —
   see Key Fictions + Glossary "Deep sky."

2. **Drift, discover, warp.** The three primary verbs across all modes.
   Drift = float through space, camera moves gently, planets orbit.
   Discover = every system is different; finding a terrestrial world or
   alien megastructure is rare and meaningful. Warp = click a star, hit
   spacebar, watch the fold animation, arrive somewhere new.

3. **The warp is sacred experience.** Not just travel. A moment outside
   space-time. Should feel psychedelic, vast, increasingly strange as
   player gains experience. Progression: early-game functional → mid-game
   anomalies (something in the tunnel) → late-game encounters (warp
   becomes a *place*, not a transition). Never explained.

4. **Powerful but fragile.** [GAME tier] The player is the scion of a
   breakaway human line — exceptional propulsion tech, but no faction
   support, no backup, possibly hunted. Extraordinary capability paired
   with total isolation. The ship is old, temperamental, fundamentally
   superior — like inheriting a hand-built mechanical watch in a world
   of digital ones.

5. **Both modes coexist.** Screensaver mode is not a tutorial for game
   mode; they are siblings sharing a universe. A change to one must
   not break the other.

## Aesthetic

**Status:** SKELETON — Max to refine.

- **CRT retro** — scanline filter (optional polish), retro UI palette,
  diegetic terminals
- **Slow contemplative pace** — drift over action
- **Strong silhouettes** — planets, ships, megastructures read as
  shapes before they read as detail
- **Bespoke shaders, not photorealism** — each planet type has
  signature look; not trying to look real

**Reference images:** [MOOD/README.md](MOOD/README.md) indexes the
visual corpus at `/mnt/c/Users/Max/Pictures/well-dipper/`. Annotated
references cited by name from this doc when used in decision.

## Key fictions

In-fiction claims the game makes. Distinct from systems; this is "what
the game says is true."

**Status:** SKELETON — Max to refine. Lore from archived Bible §1 +
archived FEATURES/_drafts/GAME_BIBLE_diff_warp folds in here.

- **Ship is house-sized.** Approximately the volume of a small house.
  See `SYSTEMS/ship-spawner/` when authored for technical scale.
- **Propulsion is exotic.** Personal warp capability — the player
  carries their own fold generator when most people depend on
  infrastructure (stabilized warp gates). More efficient than modern
  corporate drives.
- **Portal geometry is non-Euclidean.** The warp portal is a 2D hole
  opening into a 3D tunnel. The tunnel exists only through its opening;
  it has no "side" that can be viewed from outside. (From archived
  FEATURES/_drafts/GAME_BIBLE_diff_warp.)
- **The breakaway line.** Player is scion of an eccentric human line
  that split from mainstream civilization ~1 millennia ago. Different
  technology, different culture, different priorities.
- **Deep sky destinations are NOT navigable.** [Updated 2026-05-18 per
  intake] Procedural Milky Way model means everything in the pipeline
  is built on mathematical seeding. Nebulae and external galaxies exist
  visually but the dice-roll arrival mechanic from first-month
  development is dead. The "deep sky" code surviving in the renderer
  serves only the title screen + debug gallery + planned Easter egg
  (warp to another galaxy → turn-back message).

## What this game is NOT

Explicit anti-scope. Helps Director say "no" cleanly.

- **Not a space sim.** No Newtonian flight model, no realistic delta-v
  budgets in screensaver mode (game mode may revisit).
- **Not Elite Dangerous / Star Citizen.** Smaller scope, retro
  aesthetic, single-player, no MMO surface.
- **Not photorealistic.** Stylized rendering with signature shader
  language per planet type.
- **Not a tutorial-driven experience.** No popups explaining the warp;
  no quest log. Player's understanding deepens through experience.
- **Not narrative-driven (in screensaver mode).** Lore exists for game
  mode but doesn't surface in screensaver — the screensaver is for
  drift + discover + warp.

---

**Source:** Authored 2026-05-18 by working-Claude as Phase 2 of v5
migration. Extracted from `ARCHIVE/GAME_BIBLE_LEGACY.md` §1-2 + intake
+ archived warp-diff draft. **Max to review and refine.**
