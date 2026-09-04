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

---

## ⭐⭐ MAX SHARPENED THIS AND HE IS RIGHT: what ships is COLOURING, not a cap

*"My point is I'm not seeing an ice cap; this is just coloring applied to continents that would be
there either way, as far as I can see. Am I misunderstanding?"*

**He is not misunderstanding. Verified in the source, not argued:**

- `frostCoverage()` in `height.glsl.js` writes **no `h` and no `grad`** — grep the whole function body
  for either and it returns nothing.
- Its single consumer is `planetShaders.glsl.js:610`
  — `albedoCol = mix(albedoCol, frostShade, frostCover);`

So F23 frost is **one albedo mix and nothing else**. It re-tints terrain that is already there, at an
opacity set by the budget. On a world whose continents all sit above the snowline, tinting every
continent white is visually indistinguishable from "the continents are white" — which is exactly what
he reported seeing. ⭐ The file says so itself in several places (*"an albedo OVERLAY (luminance-routed,
not relief)"*, *"ALBEDO banding, NOT relief"*); what was missing was anyone asking whether that is
enough to read as an ice cap. It is not.

### There IS an ice-GEOMETRY path, and it is nearly invisible

F17 glacial (`glacialCombiner`, `height.glsl.js:3089`) takes `inout float h, inout vec3 grad` — real
relief, a slope-damped ice mantle plus flow lineations. It was OFF in the lab (this session's own
doing) and is ON in the game. Turned on live on this world, `uGlacialStrength` derives to **0.581** —
and the DISCRIMINATING test, sampling the height field with it off and on:

| | rms | min | max |
|---|---:|---:|---:|
| glacial OFF | 0.29453 | −0.4198 | 1.8893 |
| glacial ON | 0.29377 | −0.4214 | 1.8855 |

It moves the surface by **0.26 % rms**. That is a texture on the terrain, not a sheet over it.

### So the capability ledger, plainly

| | exists? |
|---|---|
| snow-COLOURED ground | ✅ shipped, working — this is what he is looking at |
| layered strata banding within the cap (F22) | ✅ albedo only |
| ice mantle as GEOMETRY (F17 glacial) | ⚠ exists, derives 0.581, moves the surface 0.26 % |
| **an ice SHEET with its own surface that buries the terrain under it** | ⛔ **does not exist** |
| **sea ice / a cap continuous across the coastline** | ⛔ **forbidden by `:452`** (above) |

⭐ **The two gaps compound into exactly what he sees.** A cap reads as a cap because it is one
continuous white surface that (i) hides the land's shape and (ii) runs out over the water. This engine
can do neither: frost cannot change shape, and frost cannot cross the coast. What is left is
per-continent tinting — which is what he called it.

⛔ **Not scoped.** But note the ordering this implies: the mask fix (a) buys the coastline crossing,
and it is the cheaper half; burying the terrain needs an ice-sheet SURFACE, which is new geometry and
a bigger piece than either half named above.
