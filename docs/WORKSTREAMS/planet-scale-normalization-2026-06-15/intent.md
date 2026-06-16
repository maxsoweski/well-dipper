# planet-scale-normalization — intent

Theme B of the LOD-lab visual-quality backlog (`docs/FEATURES/lod-lab-quality-backlog.md`,
item #2 + the footprint/rate half of #8 and #10). Chosen as the first order-of-attack item
because it's the one genuine single-root with broad payoff. Serves the SCREENSAVER-MVP heart:
planets are the hero objects, and right now their scale reads wrong.

## Why we care (Max's words)

> "We need to consider the size of planets/moons. That's going to make a pretty huge difference.
> E.g., the bigger a planet, the smaller craters will appear. And the bigger the planet, the
> greater the effects of gravity and so on. Right now scale feels all over the place, like the
> size of features isn't normalized; often they (especially craters and rivers) make the planet
> look really small because of their relative size."

Related symptoms from the same backlog he tied to scale:
> #8 "The water effect (glinting in the sun) … does not work at this scale; that's how an ocean
> would look from like a mile up, not from space."
> #10 "[lava] breathes too fast (makes the scale seem small)."

## Success criteria (Max's language)

- The bigger a planet, the **smaller its craters appear** (and the more numerous) — feature
  footprint is normalized to body size, not absolute.
- Features (especially **craters and rivers**) **no longer make the planet look small** — even on
  an Earth-sized world the surface detail sits at a believable fraction of the disk.
- **Gravity matters**: bigger/heavier worlds show subdued relief; small low-gravity worlds
  (Mars/Titan) show exaggerated relief (the Olympus-Mons read).
- Animated features that "make the scale seem small" **slow down on large bodies** — lava
  breathing and storm drift read massive/slow on a giant, brisk on a small body.
- Walking the gallery, **planets read at believable scale** — nothing reads like "an ocean from
  a mile up" or a toy-sized world.

## Scope decisions (Max, 2026-06-15)

- **All three levers**: (1) feature footprint ∝ body size, (2) animation rate ∝ 1/size,
  (3) gravity-realism (relief amplitude responds to surface gravity).
- **All footprint-bearing features**, not just the worst offenders.

## Known considerations to confirm at greenlight (Claude-flagged, not Max's)

1. **The lab renders each preset at a normalized on-screen size** (camera distance measured in
   body radii — you inspect one world at a time). So this pass does NOT make big planets render
   physically bigger *on screen*; the lever is feature-size **relative to the body** + baseline
   recalibration. If you actually want body-to-body render-size differences, that's a different
   (larger) change — flag it and we rescope.
2. **Surfaced worlds cluster at radius 0.4–1.5** (Titan 0.4 → Magma 1.5); the dramatically large
   radii (Neptune 3.9 → Hot Jupiter 13) are gas giants with no craters/rivers/lava. So cross-preset
   *footprint* differentiation is inherently subtle among crater-bearing worlds — a large part of
   the footprint win is **recalibrating the baseline down** (even a radius-1.0 Rocky's craters are
   too big today), with the radius term layered on. The radius/gravity terms pay off most on the
   **rate** lever (storm drift across gas giants) and the **gravity-relief** lever.

## Architectural starting point (already in place — not invented here)

`deriveUniforms()` (`planet-lod-lab-core.js:496`) already receives `radiusEarth`, `massEarth`, and
computes `surfaceGravity = M/R²`. Every preset bundle already carries an accurate `radiusEarth`
(`planet-lod-lab.html` ~5440+). That data is currently used for gravity, gas-giant band counts, and
cloud regimes — but is **never read by the surface-feature footprint or animation-rate uniforms**.
This workstream wires the size we already have into the feature scales/rates/relief via a single
shared helper, mirroring the province-weight single-source pattern.
