# world-engine-magmatism-multiply-2026-07-01 — intent

**Increment #4-MULTIPLY** of the world-engine history program (GROUND track). The volcanic analog
of the shipped #2 (plate driver-response). Serves the SCREENSAVER heart via the program's driving
outcome: *the count of genuinely distinct, history-coherent worlds visible per minute* — here, making
volcanic worlds vary by their real thermal history instead of a uniform seed draw + perfect circles.

## Why we care

Max UAT'd #4a (volcanic/magmatism) and accepted it **as the correct Tier-3 skeleton**, but the look
read **"crude / too regular"**: the volcanoes are **perfect circular domes**, and their sizes are
**"one giant + several arbitrary smaller ones"** — a uniform seed draw, not something that tracks the
world's history. He wants volcanic worlds where the **sizes track thermal history** (a heavily
tidally-heated / young world should be more volcanically active — more, bigger plumes — than a cold old
one) and the **shapes read as natural fissure-aligned edifices**, not isotropic analytic bumps. This is
the same move as #2 for plates: *relief responds to the body's drivers*, so two volcanic worlds that
differ only in their formation drivers read as genuinely different worlds. It is explicitly NOT cosmetic
render-noise — the naturalism comes from the causal layer (driver-response), in time's-arrow order.

## Success criteria (Max's language)

- **Volcano sizes track thermal history, not a coin-flip.** A hotter (more tidally-heated / younger)
  volcanic world shows more and bigger plumes; a colder/older one shows fewer/smaller — at the *same
  seed*, sweeping the thermal driver visibly changes the volcano field from one world into a different
  world (fixes "one giant + arbitrary smaller ones").
- **Volcanoes aren't perfect circles anymore.** Edifices read as elongated / fissure-aligned along a
  consistent grain, not isotropic domes (fixes "crude / too regular"). The elongation grows with the
  thermal driver (more heat → more rifting → more elongation).
- **The worlds still read as volcanic worlds, coherently.** Lava still reads as shields + dark flood
  plains; Magma still reads as a wide substellar magma sea. The fix adds naturalism; it doesn't break
  the #4a structure (plume-organized, Lava ≠ Magma, edifice > plain > basin ordering).
- **Nothing else regresses.** The Earth-like plate worlds, the icy/despun worlds, and a "neutral" volcanic
  reference world are unchanged (byte-identical) — this is a MULTIPLY on top of the validated skeleton,
  not a rewrite.

## Scope decision (2026-07-01, Max)

The ROADMAP note said grain-alignment should "read the E6 grain field." Grounding proved that field is
**not usable on the volcanic path** (`carrier.grainAngle` is zero-inited and `writeGrainSphere` only runs
on the despun branch; where grain *is* written it's a binary **latitude**-derived value that AC3 forbids
aligning to). **Max chose: derive a seeded volcanic fabric** — each plume gets a seeded major-axis + an
elongation factor scaled by the thermal driver — so the anisotropy is deterministic, three-free, and
**non-latitude** (AC3-safe). See `GROUNDING.md` §4.
