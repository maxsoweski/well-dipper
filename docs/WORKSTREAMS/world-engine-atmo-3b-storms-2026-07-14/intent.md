# world-engine-atmo-3b-storms-2026-07-14 — intent

## Why we care

Max (2026-07-14): "Realistic variety of giants' atmospheres driven by physics; also, the
visual detail of the storms/atmospheric phenomena is seriously lacking today."

On the detail gap, both levels are felt: "the spot reads as a simple oval, the storm bands
don't ever look like jupiter's bands that appear like ink dropped in water, there's just not
enough visual complexity in the rendering; we'll need to figure out all the different kinds
of atmospheric phenomena and how they can differ visually."

**Line of sight → north star:** distinct, history-coherent worlds visible per minute. #3b is
what turns the giants from striped balls into *planets* (GRS, hexagon, dark spot), and it
builds the storm-mask + phase infrastructure that #4 lightning, #5 brown-dwarf, and #8 Mars
dust all read (ATMOSPHERE-PLAN DAG).

## Success criteria (Max's language)

- **Physics-driven, not dice:** storm/vortex placement and structure derive from the #3a
  shear physics — kills "the sense that we're just rolling dice on specific variables."
- **Visual complexity — scene level:** giants show the real phenomena families, physically
  arranged (vortex streets, polar structures, aged spots, companion clouds) — not one
  hash-placed oval.
- **Visual complexity — render level:** bands can read like "ink dropped in water"; a spot
  no longer "reads as a simple oval." There is "enough visual complexity in the rendering."
- **Phenomena taxonomy:** "figure out all the different kinds of atmospheric phenomena and
  how they can differ visually" — a ratified design doc that this and later atmosphere
  increments build against.

## Explicitly routed OUT (Max's ruling, 2026-07-14)

Max's full "works" criterion — "every re-roll of seed produces a seriously different-looking
planet, even among the same types, where the chemical composition, planet history, and
weather phenomena create a unique 'may never see this again' visual impression" — is
**per-seed variety**, which Max ruled out of #3b ("so long as per seed variety is scoped for
some increment(s) I'm fine with it not being in 3b"). It becomes the UAT criterion of the
**derive-not-freeze variety increment** (the `shellDepthFrac`/`internalHeat`/`dissipation`
D-slot MULTIPLY, ATMOSPHERE-PLAN §(e) / ROADMAP V2-6 row), queued as the immediate next
atmosphere increment after #3b. Within #3b, re-rolls vary storm longitude/phase/mix only.

## DOES / UNLOCKS (Rule 15 card)

**DOES:** replaces hash-random storm placement with a deterministic physics writer
(shear-argmax + PV staircase) emitting a continuous storm/convection mask, per-vortex
seeded age (chromophore white→red), CH₄ companions, and a per-vortex phase bank; upgrades
the render so band boundaries and storm interiors carry shear-keyed turbulent detail;
delivers the ratified phenomena taxonomy.

**UNLOCKS:** #4 emission v2 (lightning Poisson on the storm mask), #5 brown-dwarf
(patchy drift on mask + phase), #8 Mars (relaxation oscillator on phase infra); the
derive-not-freeze variety increment reads the same writer inputs; every later giant-facing
increment reads the taxonomy doc.
