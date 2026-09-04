# solid-relief-deck — intent

## Why we care

Max, 2026-09-04, asked why he wants this batch:

> *"I want all rendering features wired in so planets are distinct and variable. Much more
> development is needed but this lays the groundwork."*

It stands on his condition from the day before, which is what put this arc ahead of the lighting
engine at all:

> *"Lighting should be next but only if we now have all world engine rendering in the game."*

The coverage audit (`docs/WORKSTREAMS/coverage-audit-2026-09-03/`) answered **no**. Thirteen surface
features run in the lab and the game never switches them on. This workstream is the carriage for
eleven of them.

⭐ **"This lays the groundwork" is the scope discipline, quoted back.** This is a WIRING workstream.
It carries the lab's own laws into the game unchanged. It does not tune what any of them look like —
the dune strength, the dust veil, the relief amplitudes are the lab's answers, and if one of them
reads wrong in the game it reads wrong in the lab too, and that is a logged lab defect, not a
number to invent here (`feedback_wire-dont-shoestring`).

⭐ **Mountains ride along, on his call.** He had put mountains third in the order (*"1 then 3 then
2"*) because they were recorded as generation-blocked. The population read found that wrong — the
block is in the pre-computed terrain path, not in the runtime switch, which is live on 103 of 124
worlds. Shown that, he answered **"2 yes"**. The remaining mountain question — why the plate-based
terrain builder claims zero worlds — stays as its own next arc.

## Success criteria (Max's language)

- **"All rendering features wired in."** Every one of the thirteen that CAN be wired is wired.
  Eleven can. The two that cannot are named with a one-line reason each, not silently dropped:
  crystal facets (no generated world clears the predicate — 0 of 124), and bioluminescence (its
  gate is wide open on 68 worlds, but the AMOUNT is a lil-gui slider set by eye with no law behind
  it on either side — forwarding it would author a constant, which is the refusal `polarDeck` already
  made for `uPolarAmp`).
- **"Planets are distinct and variable."** Two different worlds, flown up to, do not read as the
  same ball repainted. The measured proxy is that each wired feature takes many different values
  across the corpus rather than one — the population read records 9 to 107 distinct values per
  feature over 124 worlds, and none of that variation reaches a pixel today.
- **The small moons stop being bare.** 41 of the 124 worlds — everything under about a fifth of
  Earth's size — get no pre-computed terrain at all. On those, these switches are the only road
  detail can take. This is the sharpest single thing the batch buys.
- **Nothing that already ships moves.** Rivers, seas, coastlines, craters, ejecta rays, storms, the
  crust-colour pass and the terminator removal are all UAT-closed. With the deck's gate off the
  render is byte-identical to today.

## What he will judge

He flies up to worlds in the live game with one key that flips the whole deck off and on
(`feedback_showcase-by-parking-the-live-game`). The question is his: do planets read as distinct and
variable. Not whether any individual feature is beautiful yet — "much more development is needed"
is his own framing and the UAT gate is written to match it.
