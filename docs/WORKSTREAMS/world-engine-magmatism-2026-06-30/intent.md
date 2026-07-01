# world-engine-magmatism-2026-06-30 — intent

> Status: drafted by working-Claude from the north-star, the ROADMAP §4 planning note, the
> UAT-RUBRICS #4 card, and the shipped `plates.js` template — following the shell-relief precedent.
> The "Why we care" wording is Claude's draft, NOT a Max quote. Max: reword if it's not how you'd put it.

## Why we care

The screensaver only earns attention if each world looks like it has its own history. Today the
volcanic worlds don't: Lava (hot airless), Magma (K2-141b), and Io-type bodies all fall to the same
`sin²(latitude)` band smear, because only Earth-like/ocean (`plates.js`) and the icy/despun family
(`shellRelief.js`) have real history writers. A lava world should read as a lava world — shield
volcanoes and edifices sitting on their hotspots, dark effusive lava plains flooding the lows, and
for a tidally-locked extreme-T body, a molten magma-ocean basin under the star.

This is the next broaden step: one new sibling writer (`magmatism.js`) takes ~2–3 more archetypes from
historyless-bands to has-history. Like `plates.js` and `shellRelief.js` it's a *sibling* — the volcanic
gate is checked only after the Earth-like and shell paths return — so it physically cannot touch the
validated plate path or the icy path. Placement is seed-only this increment (driver-response deferred,
exactly as `plates.js` shipped). Venus (#4b stagnant-lid) is a NEAR sibling that reuses the same plume
field; it is being de-thinned by a parallel research pass and scoped right after.

## Success criteria (proposed — observable, plain terms; Max confirms / rewords)

- Pick **Lava** or **Magma** in the lab and you see real volcanic landforms — shield edifices, dark lava
  plains, and (for the locked Magma world) a **substellar magma-ocean basin** — instead of latitude bands.
- The volcanoes sit **ON a seeded mantle-plume field** — move the seed and the whole hotspot layout moves;
  they are NOT random stickers sprinkled over the sphere.
- **Same seed → the same volcanic world every time; a different seed → a visibly different hotspot layout**
  (pure function of the integer seed — no `Math.random`, no `Date.now`).
- **Earth-like and ocean worlds look exactly as they do today — byte-for-byte untouched.** The icy/despun
  worlds also unchanged. A locked lava world must NOT get handed icy cracks or plate ranges.
- **A probe proves the relief is explained by the plume/hotspot geometry, not by latitude.**
- **It reads, to Max, as a set of distinct volcanic worlds** (Io shields ≠ flood-lava plains ≠ magma sea) —
  the UAT gate, Max alone.

## Out of scope (this increment)

Venus #4b stagnant-lid (parallel research → own scope right after); driver-RESPONSE (seed-only here, like
`plates.js` shipped); Mars stagnant-lid-rocky (its own research pass — Venus-shaped ≠ Mars-shaped);
exotic-shattered #4.5; bombardment #5; the epoch model #6; the game `Planet.js` port. All named + deferred.

**Edifice SHAPE naturalism is deferred, NOT final (added 2026-07-01 from Max's #4a UAT).** This increment
ships **isotropic, circular, analytic `(1-r)^p` shield domes** — that is the *skeleton*, not the intended
final look. Real volcanic asymmetry comes from later causal layers, and the earlier draft of this doc did
not say so (a reader could wrongly assume circular domes are final). The pieces and their homes:
(a) **grain-aligned / fissure asymmetry** (elongate edifices along the E6 tectonic-grain, not perfect
circles) and (b) **plume size/count from thermal history** (so worlds aren't "one giant + arbitrary
smaller ones") → **increment `#4-MULTIPLY`** (the E7 driver-response pass, mirroring #2); (c) **flank
collapse / surface roughness / weathering** → **#7 sculpting + #8/E8b weathering**; (d) **basin-vs-plain
legibility** as a molten-now-vs-solidified-older thermal/age read → **#8 E12 palette + the F41 shader**
(deliberately OFF in the carrier-assessment view — the *data* ordering is correct now). See the ROADMAP
`#4-MULTIPLY` and `#7` planning notes.
