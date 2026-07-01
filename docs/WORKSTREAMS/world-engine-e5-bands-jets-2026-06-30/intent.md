# world-engine-e5-bands-jets-2026-06-30 — intent

## Why we care (Max's words)

> "Variety and depth/layers of atmospheric phenomena. Dynamic weather/atmospheric phenomena that look like they're part of a cohesive whole, not repeating across 3 bands all the time but also not looking like random noise. Replicate all the weather phenomena we've directly observed or scientifically theorized."

This is the APPROVED opener (#3a) of the World-Engine ATMOSPHERE track — the single load-bearing substrate every later atmosphere increment reads. It takes the gas-giant band/jet story off a hard-coded `sin(lat·k)` shader inline and onto a real, seeded, driver-organized field written by `src/worldengine/base/climate-e5.js`. One increment lights four archetypes (Jovian, Saturnian, Neptunian, sub-Neptune) and stands up the `u(lat)` / temperature / obliquity substrate the whole track recycles. It is GENERATIVE, not simulative: bands are the seeded closed-form END-STATE placed as fields over the sphere (functions of latitude + per-body driver scalars), never a time-stepped simulation.

## Success criteria (Max's language)

A gas giant should read as **one weather system, not three stripes on repeat and not TV static.** Concretely:
- The bands/jets you see come from the **writer's field**, not a formula baked into the shader — the same field a headless test can check.
- **Every world is its own world.** Jupiter ≠ Saturn ≠ Neptune ≠ a hazy sub-Neptune, and two seeds of the "same" archetype don't look identical.
- The look is **caused by the body's physics, not decoration**: fast spinners get more bands; ice-giant equatorial winds blow the *opposite* way from Jupiter's (retrograde); Neptune's winds are the *fastest* even though it gets the least sunlight (the wind paradox); a tipped-over world like Uranus flips to **hot poles / cold equator**.
- Bands have **depth, not flatness** — wispy filament texture riding the shear, plus ammonia "mushball" compositional banding — so a band reads as a churning belt, not a paint stripe.

Deliberately OUT (later increments, do not build here): the self-luminous EMISSION register (aurora / lightning / thermal glow / hot-Jupiter correct render); vortex / great-spot / storm placement (#3b); terrestrial precip/temp/wind feeding E9 (#7); and the missing archetypes (Mars-class, lava/rock-vapour, Pluto/Triton, brown-dwarf). Determinism discipline is inherited from `plates.js`: `alea` off `macroSeed`, disjoint namespaces, no `Math.random`/`Date.now`, byte-identity at a reference point, gas-giants-write-no-relief.

**Line of sight:** ATMOSPHERE Track-A north star = the COUNT of genuinely distinct, history-coherent worlds visible per minute in the screensaver. #3a converts 4 archetypes from a hard-coded stripe pattern to real, per-body, per-seed atmospheres — the largest single variety jump in the track and the substrate all 8 downstream increments read.