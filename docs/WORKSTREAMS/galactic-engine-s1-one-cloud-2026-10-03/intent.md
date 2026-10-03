# galactic-engine-s1-one-cloud-2026-10-03 — intent

Serves JOURNEY milestone **Enriched** ("visiting a system shows depth"). First slice of the Galactic Engine
(`docs/FEATURES/galactic-engine-PLAN.md`), built under the `lab-wired-to-game` skill.

## Why we care
Max, 2026-10-03:
- "how it renders when the player is in a system that is close enough to see it, and how the rendering changes,
  and how close the player is, including getting quite close to them or even being inside of them, such that they
  meaningfully color a huge part of the star field from the player's perspective."
- "what I would like to do first is just get good at using procedural generation to produce cloud-like structures
  with layers and transparencies and so on, such that nebulas look good at any distance, including being inside of
  them. If we can figure that out, we can make some quick wins there and then we can apply that knowledge … to the
  harder problem of the Milky Way."
- "I want this to be working in parallel from day one here." (lab and game)

## Success criteria (Max's language)
- "I basically want to consider how these things would look realistically speaking if you were actually that close
  to them at each of these levels. And then further enhance that so it matches our game's aesthetic and looks
  interesting for the player."
- Layers: "how we render the three-dimensional volumetrics of these kinds of massive structures. There are denser and
  lighter parts. These are basically giant clouds that have things like filaments and greater densities. And of
  course, there's stars around and in them sometimes."
- Far, approaching, inside — Max: "all of these sound basically right" to:
  - far: a soft glowing patch with some structure, small is fine;
  - approaching: it grows, more structure appears, its colour starts to tint nearby stars; a flat picture is the
    failure;
  - inside: haze all around, thicker in some directions, dark dust lanes, stars dimmed/reddened behind the dust,
    brighter knots near hot young stars.
- "we need to decide how many different LOD levels we need to be developing this for … both for game optimization
  and clarity, at the resolution that we've chosen."

## Detail levels (Claude's recommendation, from `research/RESEARCH_nebula-structure-and-scales.md`)
The sky is rendered ONCE per system (baked during the warp), so detail levels are a per-warp choice, not a per-frame
cost. Three regimes, with detail fading in continuously inside each (so nothing pops):
1. **Distant** — the nebula is under ~20 game pixels: overall shape, colour, big cavity.
2. **Landmark** — outside it, filling a big part of the sky: cavity wall, bright rims, globules, pillars, the
   filament network, dust lanes against the glow.
3. **Inside / within ~10 pc** — glow all around (about half the brightness of its centre seen from outside),
   filament widths, dense cores, embedded stars, stars behind dust dimmed and reddened.
Skipped: proplyds and other sub-0.3 pc detail.

## Realism rule carried from the research
Getting closer makes a nebula BIGGER, never brighter per pixel. To the naked eye most nebulae read grey-teal;
photographs show them red/magenta. (Colour choice: see open item in the scoping recap.)

## Test subjects
One procedurally generated emission nebula, plus Orion (the real one already in the game's catalogue).
