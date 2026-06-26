# world-engine-baked-relief-render-2026-06-25 — intent

**Campaign:** World-Engine production-L1 port. **Renderer:** LAB only (game `Planet.js` shader demotion deferred/OUT).
**This is increment 1 of the "full-A" render port** the 2026-06-25 generative-architecture assessment recommended and
Max greenlit the direction for (`docs/FEATURES/world-engine-genarch-assessment-2026-06-25/ASSESSMENT.md`). Decision #6
("augment, not replace" — render expresses only the orientation grain) is **reopened**: the renderer now expresses the
relief **as baked structure-as-data**, not in-shader noise oriented by a grain.

## Why we care (Max's words)
The world engine is a **story engine** (spine §0): *"what you see when you look at a planet IS its billions-of-years
history; procgen WRITES the history as DATA, rendering only READS it. Procgen decides, render expresses."* WS4's UAT
failed because the production renderer kept the relief **height** as in-shader noise and carried only a latitude-banded
orientation grain — *"it's just a change in the shader from random to having a grain… an overlay on top."* The fix Max
set this session: stop bouncing micro-decisions and **proceed toward the outcome** — the relief the renderer draws must
BE the generated structure, read from a sphere-native baked field, not invented by the fragment shader.

This increment deliberately proves the **riskiest un-validated part first** (a sphere-native height field → baked →
sampled → displaced, seam-clean, with the river router routing on that same baked field — no data/noise split) on a
**coarse** elevation field, before the heavier follow-on swaps in the full E6-build + E9-carve substrate. Reaching the
destination (full-A), de-risked in order.

## The bar this increment is judged against (Max's words — the WS4-SCOPED bar, NOT "where are the continents")
Per WS4 `intent.md:15-21`, the continents/plate-shaped macro-structure bar is **explicitly deferred** to later engines
(E7/E8/E11) and Option C (a one-pass plate model). This increment is judged on the WS4-scoped bar:
> "Looking at the planet as a whole, you can see the results of the forces that formed it: the relief reads as a
> coherent tectonic system… not random scatter — small-detail noise is fine." + "Flipping the [baked relief] off→on
> reads as uncut → relief that comes from generated structure, with drainage cut into that same relief." + "With the
> strength dialled to 0, the planet is byte-identical to today (safe fallback)."

## Success criteria (Max's language)
- The low-frequency relief the renderer draws **comes from a generated field (data)** that is the same every time for a
  given body — not re-invented from shader noise. You can see the surface deform to match the generated structure.
- **Drainage follows that same baked relief** — the rivers route on the field the surface is displaced from, so water
  runs down the real generated relief (one source, not "surface says one thing, rivers say another").
- It reads coherent **across the whole sphere — no seam, no pole artifact** (the relief and the rivers don't break or
  ridge-up at the cube edges or the poles).
- Dialled to **strength 0, the planet is byte-identical to today** (safe fallback).

## Explicitly NOT in this increment (named follow-ons, not abandoned)
- The full **E6-build + E9-carve substrate** ported onto the sphere (the heavy "full-A" content) — increment 2.
- **Option C** (one-pass plate-placement model so continents/ranges-at-boundaries/cratons exist as data) — the eventual
  scope for Earth-like macro-structure; sequenced after full-A lands.
- Any **game `Planet.js`** change — lab≠game by charter; the game-shader type-demotion (WS3 F5) stays deferred.
