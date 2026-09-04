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

---

# Addendum — the lab's preset temperatures were NOT a bug, and the fix is a different thing

Max, 2026-09-05: *"all of these changes we're making are happening both for the game and the world
engine lab, yes? That was the whole point of wiring this stuff up…I'd rather be able to watch these
changes in the lab, would save time."*

**The answer to the question is yes.** One definition of the law, not two — `frostPermanence` and
`frostLatChill` are in `deriveUniforms`, which the lab calls directly and the game calls through the
pack; the shader change is one file. Verified live in both rather than assumed: the derived gradient
reads 0.157 / 0.168 / 0.600 across three atmospheres in the lab and 0.162 on the anchor in the game,
with nothing left at the old 0.35. And `frost` is ON in both maps — the game rules ten gates off
(mountains, canyons, scarps, plateaus, tessera, lava, sublimation, dust, dunes, karst) and frost and
glacial are not among them.

## ⛔ AND THE THING I CALLED A DIVERGENCE IS A DESIGNED FEATURE

I reported that the lab's presets "don't render at the temperature their `T_eq` states" and
recommended fixing it. **That recommendation was wrong and is withdrawn.** `drawPresetConditions`
(`driver-presets.js:294`) re-draws the condition scalars per macro seed — *derive-not-freeze*. A
preset is an ARCHETYPE, and each seed draws a world from that family:

| preset | label | drawn across seeds 0–7 |
|---|---:|---|
| `Rocky (Earthlike)` | 288 | 306, 314, 300, 289, 297, 283, 270, 280 |
| `Ocean (temperate)` | 295 | 308, 267, 301, 282, 300, 275, 315, 274 |
| `Frozen (airless)` | 60 | 61.5, 62.7, 59.2, 55.6, 64.1, 65.4, 61.8, 58.2 |
| `Titan (methane seas)` | 94 | 94 on every seed — a NAMED REAL BODY, excluded from the draw |

That is per-seed variety working exactly as designed, and "fixing" it would have deleted it. Second
time this session a measurement caught a recommendation of mine before it broke something that worked
(`feedback_recalculate-the-recommendation`).

## What was ACTUALLY wrong, and what shipped instead

**The frost folder showed every knob except the world's own temperature** — the one input that decides
all of them. So the seed-1 `Ocean (temperate)` is a **267 K** world, below freezing, and nothing on
screen said so. Watching it stay snowy and concluding the snow law was broken is the trap, and I fell
into it in this session.

**Shipped:** one live `.listen()` slider — `⭐ surface temp (K) — DRAWN` — at the top of Cryo / Frost,
riding an existing line (§10 line-stability). The frame loop already writes
`uniforms.uPlanetTempEq.value = state.tempEq` (`:5466`), so it is a **dial, not a readout**:

| dragged to | snowline |
|---:|---:|
| 240 K | 0° — frozen through |
| 260 K | 7° |
| 280 K | 44.6° |
| 300 K | 72.2° |
| 330 K | bare |

⭐ That is Max's own criterion — *"as things get colder, more ice coming down from the poles… as it
gets warmer less ice"* — with his hand on it. Measured live after a hard reload, and the check
DISCRIMINATES: the uniform tracks the slider and the snowline moves monotonically, so it cannot pass
as a readout wearing a slider's clothes.

Suite: 20 pre-existing failures before and after, zero new.
