# Follow-up — the mountain snow, and why I withdrew the recommendation to fix it

Max, 2026-09-05, UAT: *"Ice worlds still look like ice; that world you parked at…I don't think I'd
say it looks 'right' because of all the semi-developed features e.g. rivers but the mountains are
ice/snow-covered so I'd say that's a success."* Then: *"What's wrong with the mountain snow?"*

⭐ **Answering that question honestly retired my own recommendation.** I had said the altitude term
should be fixed next. It should not, and this file is the reason.

## What I could actually establish

1. **`uFrostLapseRate = 0.3` is underived.** Nobody chose it from physics; it is the second of the two
   knobs `FOLLOWUP-frost-budget.md` named, and it is still sitting where a lapse rate belongs.
2. **It is now the term doing most of the work.** On `Rocky (Earthlike)`, the sea-level snowline
   yields *nothing* — the latitude gradient contributes zero — and **33.8 %** of the surface is
   painted white by altitude alone. Measured live, `LIVE-CHECK.md`.
3. **Its span is 215.6 K across one world's relief** (94.2 K per unit of `h`, over an observed
   `h` of −0.297…1.993).

## ⛔ What I could NOT establish, and it is the whole point

**That 216 K is too much.** I claimed it was, by comparing it to Everest's 58 K. That comparison
needs a kilometres-per-unit-`h` conversion, and **the engine's two instruments disagree about it.**

`src/worldengine/instrument/sampling.js:44` defines the conversion, and calls it exact:

```
heightUnitsToKm(hUnits, radiusEarth) = hUnits * radiusEarth * 6371
```

Applied to the field I sampled off the *compiled shader* on that same world (radius 5,217 km):

| | |
|---|---|
| `h` range | −0.297 … 1.993 |
| through `heightUnitsToKm` | **−1,547 km … 10,397 km** |
| i.e. the tallest point | **1.99 × the body's own radius** |

A mountain twice as tall as the planet is wide. So either the shader tap's `heightUnits` is not a
unit-sphere fraction, or `heightUnitsToKm` does not apply to it. **One of the two is wrong, and until
that is settled nobody can say whether the altitude cooling is right, including me.**

## The recommendation, recalculated

⛔ **Do NOT retune `uFrostLapseRate`.** Two reasons, and the first outranks the second:

1. **Max looked at it and the mountain snow is the part he called a success.** Tuning a constant away
   from an observed good outcome, on the strength of a comparison I have just shown I cannot make, is
   how a working thing gets broken.
2. The measurement that would justify a change does not exist yet.

⭐ **The smaller, sharper thing worth doing instead: resolve the height field's physical scale.** It
is not a frost problem — it is a measurement problem sitting under every altitude-dependent law in the
engine (frost, glacial confinement, sublimation, the LOD approach criterion). Whoever needs a real
km number next is blocked on the same disagreement.

⚠ **And the residual risk, stated plainly rather than fixed:** the constant is load-bearing *by
accident*. It reads correctly on the worlds looked at so far. On a world whose relief happens to run
to a different range it will over- or under-produce, and — because there is no scale — nobody will be
able to say why. That is a latent surprise, not a present defect, and it is logged here rather than
carried as an open ask.
