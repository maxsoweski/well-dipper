# naming-prism-segments-2026-10-02 — intent

Plan: `docs/FEATURES/naming-prism-segments-PLAN-2026-10-02.md` (draft 4; Max ruled "go with recs" 2026-10-02).
Origin: Max's UAT walk of the nav, `docs/WORKSTREAMS/nav-restorations-2026-09-20/UAT-walk-2026-09-30.md`.
Serves the 35% SCREENSAVER MVP: the nav is the pilot's instrument for choosing where the ship goes.

## Why we care

> "at each level of the navigation screen, what should be represented by the cells in the grid is the next level down
> in terms of resolution. So, each cell in the galaxy should represent a single sector. Otherwise, we won't be able to
> actually navigate between them coherently."

> "the naming convention that we set up to ensure that every star system has a unique name in the game has resulted in
> this thing where like it just looks like a bunch of meaningless strings of letters and numbers in the navigation menus."

> "I like the Elite approach of having readable syllabes at the beginning, and naming stars (outside of those that are
> real catalogues stars, in-universe fictional systems etc) based on their galactic location."

> "right now you can just press R and F or drag the vertical slider but it takes minutes to go from one section to
> another. If we built a segmentation system, you could see the un-highlighted segments in the nav bar and click or drag
> to a new one quickly, or use existing R and F controls to slowly pan up or down"

> "the prism view is so slow and laggy that it's basically not useable. The update build for the prism nav view needs to
> include performance optimization"

> "it took a lot of consideration to come up with the last system. I need to make sure we're not just slapping on a new
> process here."

## Success criteria (Max's language)

- Each cell in the galaxy is a single sector; each cell in the sector view is a single region; each cell in the region
  view is a single prism — click any cell and land in exactly that place; drag and the cells stay the same places.
- Every grid can be read: I can tell which cell is which and which direction I'm moving.
- The prism view is usable: no freezes entering, browsing or leaving it, near the core as well as at Sol.
- I can see the segments of the prism in the nav bar and click or drag to a new one quickly; R and F still pan slowly.
- Star names start with readable syllables and say where the star is; real catalogue stars and fictional systems keep
  their names; every name is still unique (the July work is extended, not replaced).
- The where-am-I label shows the full address (system · sector · region …), colour-coded to the map highlight.
- The autopilot drills through the same cells I would.
