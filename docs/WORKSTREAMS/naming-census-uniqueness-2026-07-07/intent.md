# naming-census-uniqueness-2026-07-07 — intent

Lane C (system details) of the 2026-07-07 four-lane campaign. First of two planned
workstreams in this lane; the successor (real-universe overlay, Max's ask 3) gets its own
contract once this one's evidence exists — see "Out of scope" below.

## Why we care

Immersion. In Max's words (2026-07-07):

> "I want to ensure none of the proc gen names overlap" — "I don't want players to
> encounter the same system name twice (unless they're re-visiting a system they
> already found)."

And on the naming scheme itself:

> "make sure I'm happy with the proc gen naming system" — "I want to understand the
> current system in depth so I can figure that out."

Nothing checks name uniqueness today, nobody has measured how often duplicates actually
occur, and the naming scheme was never ratified (the legacy Bible left it "Style TBD —
scientific catalog numbers? Fantasy names? Mix?"). So this workstream: (0) clears the two
known defects sitting in lane-C files, (1) measures the collision problem and explains the
machinery in depth, (2) puts that evidence in front of Max for a ratify-or-amend design
review, (3) implements the uniqueness guarantee against whatever scheme he ratifies.

**Discovered during scoping, folded in:** sky-click warp naming is seeded by transient
starfield index (`warp-star-${result.index}`, main.js ~9492) while NavComputer warps use
the real catalog name (main.js 2833) — the same star can get different names depending on
how you target it, and index invalidation on starfield regeneration suggests revisit names
may not even be stable. Revisit stability is half of Max's criterion, so it's in scope (AC7).

## Success criteria (Max's language)

- Players never encounter the same system name twice — unless they're re-visiting a
  system they already found, which must give back the SAME name every time, on every
  targeting path.
- Max understands the current naming system in depth — how names are made, the
  catalog/fantasy split, regional flavor, where real names come in — with real collision
  numbers and name samples at volume, so he can figure out whether he's happy with it.
- Max has ratified (or redirected) the naming scheme from that evidence — the "am I
  happy" gate is his alone.
- The two known lane-C defects are gone: the Horsehead renders (IC434/M78 position
  clash), and the 4 stale generation tests pass, tightened to the 37-profile catalog.

## Sequencing note

AC6/AC7 (the uniqueness fix) build AFTER AC5 (Max's design review) — the fix implements
the scheme he ratifies. If the review changes the scheme, this contract gets amended
through the scope skill before the fix builds.

## Out of scope (deliberate)

- **Real-universe overlay — Max's ask 3, the successor workstream.** His words: "I want
  all known systems/stars/planets we can reasonably easily find from scientific databases
  to be present in the game; that means names overwrite the algo ones … but then also
  system characteristics may have to replace the ones we have as well for those
  observed/known ones." Captured here so it isn't lost; scoped as its own contract once
  this workstream's census + explainer have inventoried what real data already flows
  through. The explainer (AC4) is written to serve that scoping.
- **`system-tags-save-search` revival** stays parked — different tag concept
  (gameplay-trait tags + save/share), ~900 lines of main.js conflicts against current
  master; revisit after lane B merges.
- **Seed stability of existing worlds** — explicitly waived by Max 2026-07-07. Procgen
  names are free to change in a one-time galaxy-wide rename: nothing durable persists
  names (localStorage = settings + camera mode only), and system contents live on a
  separate RNG stream so they cannot change.
