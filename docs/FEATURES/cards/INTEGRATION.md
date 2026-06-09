# Integration Card — cross-feature composition (Phase 5)

Each check: enable ONLY the named features (window._lab solo/enable flags),
render on :9223, screenshot to shots/INT-NN-<slug>.png, verdict 🟢/🟡/🔴/parked.
Composition machinery under test: combiner chain order, canyonHeight accumulator,
shared drivers from deriveUniforms(), the D6/P25 atmosphere gate, overlay
compositing, the posterize envelope, the LOD ramp.

## I-1 Rivers × canyons (F11×F04)
Fluvial incision and tectonic canyons share the canyon accumulator. Both on:
rivers must incise INTO canyon walls coherently, not z-fight or double-carve.

## I-2 Rivers × lakes/seas (F11×F14)
River trunks terminate at standing-liquid level; no channels continuing
underwater or hanging above shoreline.

## I-3 Deltas × coastlines × seas (F12×F20×F14)
Deltas form exactly at river–sea junctions; coastline morphology yields to the
fan; no deltas on riverless coasts.

## I-4 Frost/caps over relief (F22/F23×F01–F10)
Frost drapes topography (altitude + latitude gating), brightening ridges above
the snowline; caps follow PLD layering over underlying terrain, not paint over it.

## I-5 Glacial × mountains (F17×F01)
Valley glaciers occupy relief valleys; flow lineations align downslope.

## I-6 Sublimation × frost (F18×F22)
Pits etch INTO frost fields where insolation hits (equator-facing), absent
under fresh seasonal frost.

## I-7 Dunes × dust mantles (F15×F16)
Both need dry+windy (D5 + low liquid): they co-occur on the same worlds and
share wind direction; streaks align with dune orientation.

## I-8 Clouds over terrain × weather bands (F31a×F26)
Terrestrial clouds cluster along the ITCZ/latitude bands; ground remains
readable through gaps; cloud shadows (if any) offset with light direction.

## I-9 Bands × storms (F24×F27/F28/F29)
Spots sit IN band shear lanes (counter-rotating edges), polar vortex centered
on pole; storm colors derive from band palette, not free-floating.

## I-10 Atmosphere gate consistency (D6/P25 × everything)
An airless preset ("Frozen (airless)") must show NO rivers/deltas/dunes/clouds/
limb-glow/weather — the whole gradational+atmospheric stack gated off together,
while craters/ejecta stay crisp (no degradation).

## I-11 Aurora × magnetic gate (F37×D13)
Aurora only when fieldStrength > 0.05; ring latitude/width scale with field;
airless-but-magnetized still allowed (aurora without weather).

## I-12 Rings × eclipse shadows (F51×F52)
Ring shadow bands on planet dayside; planet shadow sweeps rings; Cassini gap
visible in both lit ring and shadow.

## I-13 Thermal day/night × tidal lock × eyeball ring (F32/F33×D7×F31f)
Locked worlds: hotspot fixed (eastward-shifted if superrotating), terminator
cloud ring stationary, nightside glow only on the night hemisphere.

## I-14 Overlay compositing (F46–F49 × base planet)
Overlays coat a natural base (spec L1c rule): base oceans/relief/weather show
through where overlay coverage < 1; ecumenopolis glow respects nightside.

## I-15 LOD coherence (F53 × all combiners)
Sweep distance 20→2 on a feature-rich preset: all enabled features fade/sharpen
together; no single feature pops or vanishes out of step.

────────── §7 verdicts (filled during Phase 5) ──────────

## 7. Verdict + tweak log
- I-1 … I-15: (pending)
