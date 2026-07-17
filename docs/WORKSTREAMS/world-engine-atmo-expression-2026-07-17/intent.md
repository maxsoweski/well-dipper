# world-engine-atmo-expression-2026-07-17 — intent

## Why we care

From Max's atmo-3b UAT (2026-07-15): the storm systems are "generally good" and confirmed
writer-driven — but the giants don't yet read as *fluid worlds*. In his words:

- "the spots/storms and bands don't seem to interact with each other, more like one is on
  top of the other" (with his gloss: "may want real upper/lower-deck layering BUT also
  modeled interaction between phenomena")
- "I do not see anything reading like ink in water; that viscous fluid effect is not being
  rendered at all today"
- "the larger shape of the bands is very regular, very much like belts" — wants variety in
  placement, direction, smooth-vs-jagged (placement + direction landed in derive-not-freeze;
  **smooth-vs-jagged** is this increment's)

The through-line: a gas giant's atmosphere is one connected fluid. Storms should visibly
belong to the band field they sit in — dragging it, folding it, roughening it — instead of
being stickers composited over a striped ball.

## Success criteria (Max's language)

- Storms and bands **interact** — not "one on top of the other": the band shapes bend/distort
  around a storm and a wake trails downstream into the band field.
- The **"ink in water" viscous fluid effect actually renders** — dye-like tendrils stretched
  along the flow and folded/rolled at shear boundaries, clearly visible (overshoot bold; Max
  dials back at UAT).
- Band shapes stop being "very regular, very much like belts": **smooth-vs-jagged varies
  per band** (turbulent belt edges ragged, calm zone edges smooth — physics-driven) plus a
  per-seed global roughness draw, so re-rolls give different edge character.

## Interview rulings (2026-07-17, in-thread)

1. **Interaction only** this increment — multi-deck parallax layering deferred (own future
   increment; different machinery).
2. **Per-band, physics-driven** jaggedness (shear-scaled) + one per-seed global dial.
3. **One increment, three slices** (interaction / ink-in-water / jaggedness) with a re-scope
   gate if any slice balloons.
4. **Overshoot bold** on the viscous read.

Pre-answered constraints honored (not re-litigated): real directional advection, NOT
stronger noise (Max already rejected the noise read at UAT); generative-not-simulative —
static place-once, no uTime; any new field is a separate new baked attribute — the aStorm
mask + phase bank goldens never move (#4/#5/#8 downstream contract).
