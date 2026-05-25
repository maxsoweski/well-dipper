# Nav computer

**Systems touched:** ui-nav-computer, rendering-galaxy, generation-galaxy

## One-sentence feature

The in-game navigation computer — a 5-zoom-level interactive map of
the procedurally generated galaxy that the player uses to orient, pick
warp destinations, and feel the scale of the place they're in.

## Tier + status

F&F-MVP. 5 rows, mixed status:

- **Level 1 GALAXY** — shipped-confirmed (the only zoom Max is fully
  happy with)
- **Levels 2 SECTOR + 3 REGION** — proposed; share one **unsolved
  multi-resolution design problem** (no working model for how to
  render detail at these intermediate scales)
- **Level 4 PRISM** — in-flight (buggy; renamed from COLUMN on
  2026-05-25)
- **Level 5 SYSTEM** — shipped-code ("good enough for now" per Max);
  not a current polish target

Visual evaluation is Max's; Claude works algorithmically + reference-
anchored, within the project's low-fi / dithered / retro envelope.

## Naming note — COLUMN → PRISM (2026-05-25)

Level 4 was named **COLUMN** in code, docs, and intake material prior
to 2026-05-25. Max renamed it to **PRISM** during the planning
walk-through. The rename pass covers code text (`LEVEL_NAMES`
constant, UI labels, in-line comments, function/variable names where
the level is the reason for the name) and live docs (`FEATURES.md`,
`SYSTEMS.md`, `PLAYER_EXPERIENCE.md`, live workstreams, this deep
dive). Historical/archived material (intake doc, `docs/ARCHIVE/*`,
older workstreams) is left verbatim — those are point-in-time records.
The rename is tracked as a bounded workstream candidate in Open
Questions below.

## Code surface

- `src/ui/NavComputer.js` (3201 lines) — main nav UI; all 5 levels;
  `LEVEL_NAMES` array at line 24 (post-rename: `'GALAXY', 'SECTOR',
  'REGION', 'PRISM', 'SYSTEM'`).
- **Default level on open:** `_levelIndex = 3` at line 41 → **PRISM**.
  (Note: `FEATURES.md` row for Level 5 SYSTEM previously claimed
  "default view on open"; code disagrees. Max confirmed 2026-05-25
  that PRISM is the intended default.)
- `src/rendering/NavGalaxyRenderer.js` (301 lines) — nav-specific
  galaxy renderer (the `ui-nav-computer` system claims this file per
  `SYSTEMS.md` Open Questions).
- `src/auto/AutopilotNavSequence.js` — autopilot drives the nav
  computer (`prism_scroll` step after rename); cross-system caller.

## Player Beats — F&F-MVP

### Level 1 GALAXY — shipped well, no current work

- **As a player, I want a beautiful, legible top-down view of the
  full galaxy with named sector overlay — so I can feel oriented in
  the place at the largest scale and choose a region to drill into.**
- **AC:** Max-confirmed satisfaction in the 2026-05-18 intake:
  *"the most zoomed out version of the navigation computer, where
  you can see the full galaxy disk, looks pretty good. I'm pretty
  happy with that."* No active workstream needed.

### Levels 2 SECTOR + 3 REGION — unsolved multi-resolution detail problem

- **As a player, I want zooming into a sector or region to resolve
  more visual detail of the galaxy at that scale — so I can feel I'm
  exploring a place that gets more interesting the closer I look,
  not a stretched image of the same view.**
- **AC:** Mid-zoom levels render galactic features (arms, bar, GMCs,
  density structure) at resolutions appropriate to the zoom — not
  stretched copies of the Level 1 PNG. Max-verbatim failure
  language: *"they're just zoomed in versions of that one image…
  we have not figured out a way to also make it look good when
  you're kind of zooming into different parts of it… We don't have
  a working model for that."*
- **Direction named 2026-05-25:** The galactic-rendering polish
  work (bar integration, color gradient, GMC artifacts — scoped in
  `docs/FEATURES/galactic-rendering.md`) should produce techniques
  recyclable for generating top-down sector/region images via the
  existing proc-gen system. Specifically: the analytic density
  model that drives `ProceduralGlowLayer.js` (real-time galactic
  glow) is the same density information that could be ray-marched
  or projected at SECTOR / REGION scales to produce
  resolution-appropriate detail. **Cross-feature coupling — fixing
  galactic-rendering unlocks the path to this Beat.**

### Level 4 PRISM — in-flight, buggy

- **As a player, I want the PRISM view to render the dense
  neighborhoods around a chosen point cleanly, with a working
  minimap and smooth transitions in and out — so I can feel the
  nav computer is a single coherent instrument, not a collection
  of unrelated screens.**
- **AC:** Three Max-verbatim PRISM bugs addressed (2026-05-25):
  1. **Minimap doesn't work that well** — the PRISM-view minimap
     (`NavComputer.js:2191` "PRISM" label site) needs investigation;
     specific failure not enumerated.
  2. **It's laggy** — PRISM rendering performance regresses below
     the smoothness bar set by other nav levels. Investigation
     needed; could be on-demand block loading (`NavComputer.js:2292`
     "ON-DEMAND PRISM LOADING" region), star sampling cost, or
     draw-call structure.
  3. **Transition into/out of PRISM feels disjointed** from the
     rest of the nav computer — the zoom-out from PRISM to REGION
     and zoom-in from REGION to PRISM don't read as continuous
     navigation. Zoom animation lives around
     `NavComputer.js:3110` and surrounding lines.

### Level 5 SYSTEM — shipped-code, parked for now

- **As a player, I want the in-system 3D view to show me where I am
  inside the current system — so I can pick a body to focus on or
  understand spatial relationships before warping out.**
- **AC:** Max says "good enough for now" (2026-05-25). Shipped-code
  status; no current polish target. Future deeper polish remains
  possible but is gated behind the PRISM work + multi-resolution
  detail problem above.

## Player Beats — ENRICHED / GAME

None additional at this tier. Future cross-cutting integrations
(visited-systems log surfacing in nav; warp-target selection that
crosses zoom levels) are tracked on those features, not here.

## Open questions

- **COLUMN → PRISM rename pass** — bounded mechanical workstream:
  code text + live docs. **Should ship before further PRISM-level
  polish** so post-rename work doesn't drift naming. Function/variable
  renames in nav-context files (`findStarsInColumn` →
  `findStarsInPrism` in `HashGridStarfield.js`, etc.) are in scope
  if the level is the reason for the name; physics/CSS "column" usage
  is out of scope.
- **Multi-resolution detail mechanism** — completely open. The
  galactic-rendering polish work is the named candidate source for
  recyclable techniques. Specifically: can the analytic density
  model that drives `ProceduralGlowLayer.js` be re-projected at
  SECTOR/REGION scales to produce per-scale detail? Research
  workstream paired with the galactic-rendering work.
- **PRISM bug enumeration depth** — three bugs named today. Further
  walkthroughs may surface more during workstream scoping.
- **PRISM minimap failure mode** — "doesn't work that well" is
  diffuse. Workstream scoping should pin down specific failure
  symptoms (wrong projection? stale data? missing star indicators?)
  before implementation.

## Workstreams

None scoped yet. Three workstream candidates fall out of this dive:

1. **COLUMN → PRISM rename pass** — code + live docs.
   Bounded, mechanical, do-first to avoid naming drift in
   downstream PRISM work.
2. **PRISM polish** — minimap fix, lag investigation, transition
   smoothness. Three named bugs each get their own AC; close as
   the named symptoms resolve.
3. **Multi-resolution detail (SECTOR + REGION)** — research +
   prototype workstream paired with galactic-rendering polish; the
   density-model re-projection direction is the starting hypothesis,
   not the prescribed solution.

## See also

- `docs/FEATURES.md` — parent Nav computer section (5 rows).
- `docs/FEATURES/galactic-rendering.md` — **direct cross-coupling**:
  bar + color gradient + GMC work is the named source of recyclable
  techniques for Levels 2/3 multi-resolution detail.
- `docs/SYSTEMS/ui-nav-computer/README.md` — not yet authored.
- `docs/_intake-2026-05-18-max-feature-status.md` §"Navigation
  computer" — verbatim source; uses pre-rename "column" terminology
  (left as historical record).
