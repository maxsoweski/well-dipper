# world-engine-star-driven-pigment — intent

## Why we care

Max, 2026-08-21, alongside the D-9 ruling that Earth-like continents should read green:

> "I'm interested in alien fauna of different colors also, having systems for that."

And the ruling it arrived with, which this workstream must not break:

> "Earth's continents are green where there are forests, if they're on the day side."

⚠ He said **fauna**; confirmed 2026-08-21 that he **misspoke and means flora** — `BIO_PIGMENT`
drives photosynthetic ground cover, the colour of vegetated land seen from orbit. Creature
colouring is a different system that does not exist in any form today and is **not** in scope here.

The through-line: a world's plant life should look like it grew under *its own* star, so that
arriving somewhere new tells you something about where you are. A red-dwarf world reading the same
green as Earth is the tell that the world is painted rather than grown.

## The correction this workstream exists on top of

⛔ **The handoff of 2026-08-21 said this was calibration-only, and that was wrong.** It claimed
`starMassEarth` "resolves 15× in `conditionFromBody.js`, so the input is reachable today." Those 15
are *name mentions* — comments and a fallback branch — not values.

**Measured 2026-08-21, 40 systems / 167 generated planets: `starMassEarth` 0/167 · `starTemp` 0/167
· `starColor` 0/167 · no star- or spectrum-shaped key on the body record at all.** The source says
so itself at `src/worldengine/port/conditionFromBody.js:445` (`starMassEarth 0/526 planets, 0/411
moons`) and gives the cause: `PlanetGenerator.generate` holds `starMassSolar` as a **local** and
spends it on tidal heating without ever recording it. `_provenance.starMassEarth` reads
`'defaulted'` on every body the game generates; the fallback is a hardcoded 1 M☉.

That error is this codebase's signature failure in miniature — a name count reported as
reachability, the same shape as the ledger's own "CARRIED: 28" that means 8 at most. It is recorded
here rather than quietly fixed, because the plan it misinformed is still on disk.

**So the star's spectrum must be plumbed onto the condition vector before any pigment law can read
it.** That is generator-side work, and Max ruled it in scope.

## Success criteria (Max's language)

- A world's ground cover colour is chosen by **which kind of star it orbits** — "the star chooses
  the bucket; I author the bucket." The spectrum picks a palette *family*; the colours inside each
  family are Max's to author, not derived.
- **An M-dwarf world does not read green.** It runs dark, or oxblood, or violet — something that
  looks like it grew under a red sun.
- **A Sun-like star still gives green continents.** The D-9 ruling holds; this system must not
  break the ordinary case in the course of making the strange ones strange.
- Flying between systems, **the difference is visible from orbit** without being told to look for it.

## Sequencing constraint

⛔ **Do not start building until B3 lands.** B3 owns the `uTerm*`/`uLimb*`/crater/**palette**/aurora
uniform family and is in flight in a separate worktree. Pigment is palette work; starting
concurrently reintroduces exactly the gate-attribution problem the B3∥B4 worktree split exists to
avoid.

Status is therefore `scoping`, not `building` — deliberately, and against the scope skill's default,
because a `building` status would be false while the palette family is owned by another block.
