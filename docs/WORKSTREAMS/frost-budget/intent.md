# frost-budget — intent

## Why we care

Max walked to a room-temperature world with oceans on it and it was drawn half-covered in permanent
snow. He asked, plainly: *"Any idea why?"*

The answer is that the snow law never asks how warm the world is. `frostMaxCoverage` is
`smoothstep(0.05, 0.4, volatileFraction)` — purely how much water a world has — and the whole
temperature test is delegated to two hand-set constants in the shader that were tuned in the lab on
frozen worlds and never met a warm wet one. **Measured: the budget is identical, to the digit, from
100 K to 1200 K at the same volatile fraction.**

This is the class of world the whole world-engine program is pointed at. Warm, wet, rocky worlds are
the ones a player goes looking for, and right now arriving at one shows a snowball. The wiring work
of the last sessions is what made the defect visible — while every warm world was a desert, no
snow law could contradict what was drawn.

⚠ **A premise in the two documents that scoped this is wrong, and the correction narrows the case.**
Both `FOLLOWUP-frost-budget.md` and the handoff argue from *"T_eq 293 K is 38 K warmer than Earth's
255 K."* `condition.T_eq` is greenhouse-corrected SURFACE temperature (`conditionFromBody.js:738`),
so the comparable Earth number is **288 K**, not 255. The world is 5 K warmer than Earth, not 38.
The defect stands — a room-temperature ocean world should not be half snow — but a law built to
close a 38 K gap would have over-corrected.

## Success criteria (Max's language)

> *"What's the Earth's average temp? Base it on that. As things get colder, more ice coming down from
> the poles/in high places, as it gets warmer less ice."*

- **Earth is the anchor.** Earth's average surface temperature is 288 K. A world at Earth's
  temperature with Earth's water carries Earth's ice — caps at the poles, about a tenth of the world,
  bare at the equator.
- **"As things get colder, more ice coming down from the poles."** Cool a world and its cap grows
  DOWN in latitude, smoothly — no jump, no step.
- **"in high places."** High ground holds ice where the low ground beside it, at the same latitude,
  is bare.
- **"as it gets warmer less ice."** Warm a world and the ice retreats poleward; a hot world has none.
- **The world he walked stops being a snowball.** `rocky-126`'s second planet — room temperature,
  has oceans — reads as a world with ice caps, not a world made of ice.

## The scope ruling, and why both halves

Max: **"both."** The two halves named in the follow-up are the budget's missing temperature term and
the two underived shader knobs, and the follow-up advised not bundling them. **Measured on the anchor
body, they are not separable:**

| | budget | snowline | painted |
|---|---|---|---|
| today | 0.834 | 26° | **47%** |
| temperature term only | 0.420 | 26° | 24% |
| real snowline only | 0.834 | 46° | 24% |
| both | 0.420 | 46° | **12%** |
| Earth, for scale | | ~66° | **~10%** |

Either half alone ships a world still 2.4× snowier than Earth — the same defect, quieter. Both
together land next to Earth.

## What is NOT in scope

- **The `ice` LABEL on that world.** A separate defect, already recorded in the follow-up and closed
  by the derived-world-class split; this workstream changes how much snow is DRAWN, not what the
  world is called.
- **The icy-body path.** The anchor measures `uIcenessMix` 0 — this is frost DEPOSITION, not an ice
  shell. `cryoActivity` and `iceness` are untouched.
- **Volatile delivery.** How much water a world HAS is upstream and shipped; this is about what
  temperature does with it.
