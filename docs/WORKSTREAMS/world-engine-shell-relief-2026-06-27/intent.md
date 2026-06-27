# world-engine-shell-relief-2026-06-27 — intent

> **Status of this file:** drafted by working-Claude from the project north-star, the
> increment-1 DESIGN doc (`docs/WORKSTREAMS/world-engine-history-program-2026-06-27/increment-1-shell-relief-DESIGN.md`),
> and Max's broaden-first decision. The "Why we care" wording is Claude's draft from those
> sources, NOT a Max quote — **Max: reword it if that's not how you'd put it.**

## Why we care

The screensaver is only worth watching if it shows genuinely *different* worlds. Right now it
doesn't: Europa, Titan, a locked "eyeball", and a frozen airless rock all collapse to the same
`sin²(latitude)` banded smear, because only Earth-like and ocean worlds have a real history
relief writer (`plates.js`). Every icy/despun/locked body is a disappointment — same bands,
different tint.

This increment is the single biggest jump in "distinct worlds per minute" for the least risk on
the board. One new writer (`shellRelief.js`) takes ~2-of-11 archetypes to ~5-of-11 — Europa
cycloids + double-ridges + chaos shells, despun-lineament eyeballs, cantaloupe volatile-cold
terrain — and because it's a *sibling* of `plates.js` (checked only after the Earth-like path
returns), it physically cannot touch the validated plate path. Broaden first: highest
variety-per-effort, lowest blast radius.

## Success criteria (proposed — observable, in plain terms; Max confirms)

- **Pick Europa / Frozen / Eyeball / Titan in the lab and you see real landforms** — cracks,
  curving cycloids, ridge networks, chaos terrain — **instead of latitude bands.**
- **Same seed → the same world every time; a different seed → a visibly different crack network**
  (no `Math.random`, no `Date.now` — pure function of the integer seed).
- **Earth-like and ocean worlds look exactly as they do today** — byte-for-byte untouched.
- **The other non-icy worlds** (unlocked airless, gas giants, lava) **keep their current look** —
  and a *locked* gas giant or lava world must NOT get handed icy cracks.
- **A probe proves the relief is explained by the tidal/despin stress geometry, not by latitude** —
  it must beat both a normal latitude band AND a band tilted onto the seeded paleo-axis (so a
  "rotated `sin²`" fake can't pass).
- **It reads, to Max, as a set of distinct, recognizable icy/despun worlds** (the UAT gate — Max
  alone).

## Out of scope (this increment)

Driver-RESPONSE (seed-only here, like `plates.js` shipped); Venus stagnant-lid; exotic-shattered;
gas/hot-Jupiter/sub-Neptune; carbon/crystal/technogenic; the game `Planet.js` port. All named and
deferred — see the DESIGN doc's Scope-out and the program ROADMAP.
