# Finding — frozen oceans have a pipeline that is DESIGNED, DISABLED, AND CONTRADICTED IN ONE FILE

Max, 2026-09-05, in the lab: *"The continents are icy but there's no cap; do we have a
shader/rendering pipeline for ice caps and frozen oceans in general?"*

**Ice caps: yes, and it is what he is looking at.** The F23 frost mask paints the cap and F22
`pldBands` gives it layered strata. That is the icy continents — the pipeline is working.

**Frozen oceans: no — and it is not a missing feature, it is a contradicted one.** Two lines of the
same shader disagree, and the earlier one wins.

## The contradiction

`src/worldengine/shaders/planetShaders.glsl.js:452`

```glsl
// F14 × F22 phase consistency: standing liquid means local T is ABOVE the volatile's
// condensation point (liquid phase, by definition) — frost cannot deposit on the open
// sea. Titan's methane seas stay radar-dark against bright frosted terrain. (Frozen-sea
// / eyeball ice-ring variant deferred — flagged in card §7 for the integration pass.)
frostCover *= 1.0 - liquidMask;
```

`…:526`, seventy-four lines later, describing the draw order:

```glsl
// F14 standing liquid — species-keyed fill mixed BEFORE frost so frost wins where
// cold (sea ice; the eyeball ice-ring falls out of the latitude lapse for free).
```

⛔ **`:526`'s "sea ice … for free" CANNOT HAPPEN, because `:452` already multiplied frost to zero
everywhere there is liquid.** The ordering was arranged to deliver sea ice; the mask forbids it before
the order matters. `:448`'s own parenthesis concedes the outcome — *"Frozen-sea / eyeball ice-ring
variant deferred"* — so the file records both the intention and its cancellation, seventy lines apart.

⚠ **AND `:452` IS NOT SIMPLY WRONG, which is why this is not a one-line delete.** Its reasoning is
correct for Titan: methane seas at 94 K are *liquid*, and they must stay radar-dark against frosted
terrain. The defect is that the test is **unconditional** — it suppresses frost on ALL standing
liquid, when the physical rule is *"suppress frost on liquid that is above its own freeze point."*
Below that point the sea is not liquid; it is the cap.

## Why THIS world shows icy continents and no cap — measured, not inferred

`Ocean (temperate)`, seed 1, live: T 267.2 K, water freezes at 273 K, sea level 0.097.

| | |
|---|---:|
| surface cold enough to freeze | **96.2 %** |
| …of the sphere, on LAND → frosts, drawn white | 52.8 % |
| …of the sphere, on OCEAN → **frost forced to zero** | **43.4 %** |
| poleward of 60°, the fraction that is OCEAN | **77.7 %** |

**The poles of this world are sea.** So the one place a cap belongs is the one place the mask forbids
it, and every continent ices over instead. That is exactly the picture Max described, and it is the
mask, not the snow law.

## ⚠ AND THERE IS AN UPSTREAM HALF: the ocean should not be liquid at all

`labCore.js` — `waterWindow = smoothstep(248, 273, T) * (1 - smoothstep(373, 398, T))`.

The window ramps IN from 248 K, so liquid-water stability is already 0.855 at **267 K** — the engine
grants this world a liquid ocean **6 K below the freezing point of water**:

| T_eq | liquidStability |
|---:|---:|
| 240 | 0.000 |
| 255 | 0.191 |
| **267** | **0.855** |
| 273 | 1.000 |

The soft edge is deliberate (*"no magic binary"*), but between 248 K and 273 K it answers "there is an
ocean here" about water that is solid. So the frozen-ocean question is not only "can frost be drawn on
the sea" — it is also "should that sea have been water in the first place".

## The shape of the work, if it is scoped

Two separable halves, and they are genuinely separable this time (unlike the snow budget's):

- **(a) the mask** — make `:452` conditional on the liquid being above its own freeze point, so a
  cold sea takes frost (sea ice) and Titan's methane seas still do not. Delivers the polar cap.
- **(b) the window** — decide what a sub-freezing world's "ocean" IS. A `seaLevel` on a 267 K world is
  either an ice sheet or it should not be there.

⛔ **Not scoped, not started.** Recorded here because Max asked and the answer was findable.
