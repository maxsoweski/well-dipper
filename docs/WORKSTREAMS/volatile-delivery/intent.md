# volatile-delivery — intent

## Why we care

Max, 2026-09-04, asked whether the galaxy should contain Earth-like worlds at all, having been shown
that it currently contains **none**:

> **"yes; I want this to be a simulation of the milky way galaxy with a wide variety of
> physically-plausible worlds"**

That ruling widened the charter's INTENT FRAME (`docs/FEATURES/planet-lod-CHARTER.md`, `a7bfe5d`):
emphasis moves from *fidelity per feature* to **variety across the drawn population**, and it added
one operational test —

> **a generation law is wrong if it makes a whole class of physically-real world unreachable**,
> even when every body it produces is individually defensible.

`PhysicsEngine.deriveComposition` fails exactly that test. It makes `volatileFraction` a pure function
of `frostRatio = orbitAU / frostLineAU`, while `T_eq` is a function of **the same variable inverted**.
The frost line is by definition where ice survives, so *temperate ⇒ inside the frost line ⇒ dry* holds
**by construction**. Measured over **1,183 solid bodies from 200 seeds: the temperate set and the wet
set do not intersect once**, and they miss by a wide margin both ways (wettest temperate body
V = 0.0595 against the plate band's 0.12; warmest wet body T = 186 K against the band's 250 K).

**This is not a mountains problem.** The same field feeds the fluvial stack, karst, dunes, dust,
coastal margins and the plate gate. Run the generator's output through the engine's OWN gate
(`labCore.js:693`, "bone-dry floor at 0.05"): of 135 temperate bodies, **78.5 % sit at or under the
bone-dry floor, 21.5 % are essentially dry, and ZERO read wet** — while 26.7 % of all solid bodies DO
read wet and every one of them is frozen. **The galaxy is bimodal: hot deserts and cold ice, with
nothing in between.** Every warm world in the game is a desert to every surface process the world
engine draws.

## What is actually wrong, in one sentence

`deriveComposition` does **two jobs with one field**. Accreted bulk ice fraction is genuinely
frost-line driven and the existing law models it correctly. Surface volatile inventory is not: inside
the frost line a terrestrial planet accretes essentially dry and then **receives** its water, delivered
late from scattered outer-system material, decoupled from the body's own frost ratio. The law has only
the first term, so the implication cannot be broken. **Adding the delivery term is the job.**

## Success criteria (Max's language)

- **"a wide variety of physically-plausible worlds"** — warm worlds draw a *distribution* of water,
  mostly low and occasionally Earth-like, instead of every one of them being a desert.
- **Earth-like worlds exist in the galaxy at all.** A body can be Earth-mass, room-temperature and wet
  at the same time; today no body in 1,183 is.
- **The worlds we already ship keep working.** Nothing about a world's size, its orbit, its moons or
  whether they are tidally locked may change — only how wet its surface is.
- **The change is visible where it matters.** A warm world that used to render as bare desert now
  renders with the water-driven features the engine already knows how to draw.
