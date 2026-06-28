# world-engine-plate-driver-response-2026-06-27 — intent

> **Status of this file:** drafted by working-Claude from the project north-star, the program
> ROADMAP (`../world-engine-history-program-2026-06-27/ROADMAP.md` increment 2), the per-increment
> UAT rubric card (`../world-engine-history-program-2026-06-27/UAT-RUBRICS.md` §Increment 2), and
> Max's in-thread scoping calls this session (D14/D2/D12; D16 age was scoped then DESCOPED at UAT
> 2026-06-28 — age IS history, so a static age nudge misrepresents it; its real home is the epoch
> model #6 + weathering #7). The "Why we
> care" wording is Claude's draft from those sources, NOT a Max quote — **Max: reword it if that's
> not how you'd put it.**

## Why we care

The screensaver's value is the count of genuinely *different* worlds per minute. The plate writer
(`plates.js`) is UAT-passed and makes Earth-like and ocean worlds real — but only the **seed**
varies them. A low-gravity Earth and a high-gravity Earth get identical plate placement; a dry world
and an ocean-rich world get the same continental split. So the two archetypes that *do* have a real
history still read as one kind of world with different dice.

This increment is the **MULTIPLY** move: thread the body's real formation drivers (gravity,
volatiles, tidal heating) into the plate writer so the *same* archetype becomes a **continuum** —
heavy worlds sit flatter, volatile-rich worlds drown more continent, tidally-heated worlds churn more
plates. It is a second-order multiplier on top of the proven writer (lower
variety-per-effort than a new writer, which is why it follows the broaden-first shell writer), and it
must do this **without changing the Earth that Max already accepted** — Earth comes out byte-identical,
the response only bends the world *away* from the Earth reference point.

## Success criteria (proposed — observable, in plain terms; Max confirms)

- **Earth comes out exactly as it does today** — the validated plate world is byte-for-byte untouched
  (driver→tune returns nothing at the Earth reference point).
- **Crank a driver and the world changes the way the physics says it should** — heavier gravity →
  lower/flatter relief; more volatiles → more ocean, less continent; more tidal heating → more
  plates — each in one consistent, documented direction, not a random wobble.
- **Two Earth-likes that differ only in their drivers look like genuinely different worlds** — not the
  same world recolored (the UAT gate — Max alone).
- **Nothing else moves** — the grain-cube bake, the despun/ice-shell relief, and the ocean/drainage
  all stay byte-identical (the plate driver channel is separate from the grain-bake driver bundle).

## Out of scope (this increment)

Non-Earth-like regimes (despun/shell is increment 1; Venus stagnant-lid #4; volcanic #4; bombardment
#5 — driver-response for *those* writers is each its own later increment); new plate STRUCTURE
(this only re-tunes the existing placement, it does not add a mechanism); the epoch/host-editor model
(#6); the game `Planet.js` port (#9). The transfer-function *shapes/signs* are a calibration task the
build owns (cite settled planetary-science scaling), anchored to return DEFAULTS at the Earth point —
analogous to how shell-relief's SLICE-B pinned its stress math before contracting the structure ACs.
