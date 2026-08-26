# Tidal drive moves from FREQUENCY to AMPLITUDE

**Status:** scoped, not started · **Opened** 2026-08-26

## Why we care — in Max's words

> *"the grain seems to delete any sense of scale because it's so fine and pops in too soon (quite far
> from the camera)"* · *"There's not a good blending from high LOD right in front of you ... and areas
> further away on the sphere"* · *"the higher lod grain that resolves seems totally unrelated to the
> shape of the grain at the lower LOD"*

And the instruction that opened this workstream:

> *"Your recommendation for number one seems good just to make sure that any change we make here is
> reflected in both the World Engine Lab and in the main well dipper game, period."*

## What is actually wrong

`docs/FEATURES/lod-architecture-rootcause-2026-08-26.md` has the measurement. In one line: **the LOD
stack has no headroom at the wavelength law's hot end.** Usable octaves between "spans the disc" and
"starts to alias", at 4 body radii — Earth-like 6, Mercury 5, Io 2, our hot bodies **1**, and **0**
before the extrapolation bound landed. With no headroom the coarsest octave *is* the grain: there is
no landform for detail to sit on and nothing left to reveal on approach. That single fact produces
all three of Max's complaints at once.

⭐ **The cause is a modelling error, not a tuning error.** `macroWavelength.js` §1 records Io by
*"a mountain, ~157 km"* and *"a patera, ~41 km"*. Those are **features on Io**, and what they record
is that Io has little **large-scale relief**. The law encoded that as a much higher base
**frequency**, which collapses the whole octave stack onto one scale. The honest encoding is lower
**amplitude in the coarse octaves**, keeping the characteristic length near one body radius — where
all seven other reference bodies sit (0.635–1.652, a factor of 2.6). Tidal resurfacing **erases big
topography**; it does not shrink a planet's characteristic length.

## Success, in Max's terms

A tidally-active world reads as **a big object that is smooth at large scales and rough at small** —
not as a small textured ball. Flying in, finer structure keeps arriving, and it arrives **late**
(close), because "when detail appears" is finally a separate control from "how fine detail is".

## Architectural connections

- **The frequency half** `src/worldengine/base/macroWavelength.js` — `macroShortening` retires as a
  frequency term. The eight-body calibration table SURVIVES; it is being read more carefully.
- **The amplitude half** — a new sizeKm/scalar driver on the `rockySurface` pack, so it reaches both
  front-ends through `writePackUniforms` by construction. ⭐ This is the mechanism that satisfies
  Max's "period".
- **The LOD half** `src/worldengine/base/labCore.js` — with headroom restored, `autoOctaves` finally
  binds, so the distance ramp becomes the art-direction control, tunable in body radii.
- **The filter half** `heightNoise.glsl.js` — `uFwClamp` returns to being only an anti-aliasing
  floor. The `[K]` legibility arm stays as a safety net, not as the LOD mechanism.

## Deliberate non-goals

- ⛔ Not re-tuning the seven non-tidal bodies. Their λ/R consensus is the thing being restored.
- ⛔ Not the 68 ungated surface features (`docs/FEATURES/resolvability-scope-2026-08-26.md`) — those
  wait on this landing, because this is the pilot that sets the bar.
- ⛔ Not touching craters. Their km-based floor already works.
