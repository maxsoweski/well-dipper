# Galactic rendering (in-game sky)

**Systems touched:** rendering-sky, generation-galaxy, galactic-bodies

## One-sentence feature

The visible Milky Way panorama in the in-game sky — diffuse stellar
glow, spiral arms, central bulge + bar, and giant molecular clouds
rendered as a 360° backdrop around the player's current galactic
position, painted in the project's low-fi dithered retro style.

## Tier + status

F&F-MVP, in-flight. Active issues are visual quality (not wiring); the
constraint envelope is the project's low-fi / dithered / retro
aesthetic. Visual evaluation is Max's — Claude works algorithmically
(identify what produces a given artifact in shader/density code) and
reference-anchored, not by self-evaluating screenshots.

## Reference

`/mnt/c/Users/Max/Pictures/well-dipper/41586_2012_Article_BF490024a_Figc_HTML.jpg`
— Nature artist's impression of the Milky Way from above. The visual
targets pulled from this reference:

- Warm golden-amber bulge integrated with the bar (not "tacked on")
- Cool blue-tinged spiral arms with pink/magenta GMCs scattered
  along them (Hα emission from star-forming regions)
- Brightness + warmth gradient: bright + warm center → dim + cool rim
- Bar and bulge composed as a single structure, no visible
  discontinuity at the bar/bulge boundary

## Code surface

- **Runtime path:** `src/rendering/sky/ProceduralGlowLayer.js` (1119
  lines, real-time GLSL ray-march of an analytic galaxy density
  model). This is what actually drives the in-game galactic glow.
- **Generation:** `src/generation/GalacticMap.js` (arm/bar
  parameters, density model) consumed by both the sky shader and the
  procedural starfield.
- **Sky composition:** `src/rendering/SkyRenderer.js` instantiates
  `ProceduralGlowLayer` (lines 157, 319) + `SkyFeatureLayer` for
  nebulae.
- **Dead-code finding (2026-05-25 inventory):**
  `src/rendering/sky/GalaxyGlowLayer.js` (126 lines) +
  `src/generation/GalaxyVolumeRenderer.js` (397 lines) +
  `scripts/generate-galaxy-glow.mjs` form an offline
  equirect-panorama pipeline that is **imported in
  `SkyRenderer.js:2` but never instantiated**. The whole offline
  branch is unused at runtime. Removal candidate — flagged in Open
  Questions.

## Player Beats — F&F-MVP

### Galactic glow + GMC angular artifacts

- **As a viewer, I want the galaxy to read as a real galaxy — billions
  of stars and gas clouds organized into smooth, organic structure —
  so I can feel held inside a place that has its own life, not a
  graphic stuck on the sky.**
- **AC:** No straight-line artifacts, no abrupt cutoffs in the GMCs.
  Cloud edges feel soft and organic at all viewing angles (cruise
  mode, looking at center, looking down arms, edge-on). Max-verbatim
  failure language: *"weird angular artifacts… streaking that looks
  kind of like it happens in straight lines or cuts off abruptly in
  the magnetic clouds."* Evaluation: Max review against reference,
  within retro envelope.

### Galaxy center + bar integration

- **As a viewer, I want the bar to look like it belongs at the heart
  of the galaxy, embedded in the bulge — so I can feel that the
  galaxy was generated as one coherent structure, not assembled from
  layered parts.**
- **AC:** Bar and bulge read as a single structure with smooth
  density blending. No visible discontinuity where the bar meets the
  bulge. Max-verbatim failure language: *"it looks more like it was
  tacked-onto a hole in the center of the galaxy."* Success = the
  opposite of that — bar reads as the bright core of the bulge, not
  as a separate object placed inside a hole.
- **Code anchor:** Bar rendered as triaxial Gaussian in
  `ProceduralGlowLayer.js:553-561`. Likely root cause: bar density
  composed additively on top of bulge density rather than as part of
  a unified density model — the two falloff functions don't blend
  smoothly across the bar/bulge boundary.

### Overall warmth + brightness gradient

- **As a viewer, I want the galaxy to be visibly warmer and brighter
  toward its center, dimmer and cooler toward its rim — so I can
  feel the galaxy's structure and orient myself relative to its core
  without thinking about it.**
- **AC:** A visible color + brightness gradient in the rendered sky.
  Center reads as warm golden-amber; mid-disk reads as cool
  blue-tinged; outer disk reads as dim. Currently appears uniform
  from Sol's vantage (~8 kpc from center).
- **Code anchor:** `stellarColor()` in `ProceduralGlowLayer.js:604-622`
  already mixes bulge/arm/disk colors. Bulge weight uses Gaussian
  σ=1.2 kpc at line 611 — only the innermost ~2 kpc gets warm tones,
  which is a small angular extent from Sol's vantage. To read as a
  gradient, EITHER the warm zone needs to extend much wider (σ ~3-5
  kpc) OR a separate inner-disk reddening ramp needs to layer on top
  with broader spatial extent.

## Player Beats — ENRICHED / GAME

None additional. Galactic rendering polish is purely F&F-MVP work; no
follow-on feature wave depends on it.

## Open questions

- **Dead-code cleanup** — remove `GalaxyGlowLayer.js`,
  `GalaxyVolumeRenderer.js`, `scripts/generate-galaxy-glow.mjs`, and
  the `GalaxyGlowLayer` import from `SkyRenderer.js:2`? Or preserve
  as a fallback path for future "burn galaxy panorama to texture"
  optimization? Out of scope for the visual polish workstream but
  worth resolving when this workstream lands.
- **Reference fidelity vs retro envelope** — the Nature reference is
  photorealistic-stylized. The game's envelope is low-fi dithered
  retro. Where exactly the two registers meet for "realistic GMCs"
  needs Max's eye in the loop; written success criteria can only
  bound it from outside.
- **Bar/bulge model: rewrite or patch?** — if the root cause is
  additive-on-top composition, fixing it cleanly likely means
  authoring a unified bar+bulge density function (not two layered
  Gaussians). PM-scoping should decide between a patch (tune blend
  weights so the discontinuity hides) and a rewrite (single
  density model).

## Workstreams

None scoped yet. This deep dive precedes PM-scoping a
`galactic-rendering-polish` workstream that covers all three issues
together (they share a code surface).

## See also

- `docs/FEATURES.md` — parent inventory rows: *Background starfield*
  (shipped-confirmed) and *Galactic rendering polish* (in-flight).
  Nebulae section is a separate deep dive (not yet authored).
- `docs/SYSTEMS/rendering-sky/README.md` — not yet authored; will be
  the system-level home when `rendering-sky` gets its first deep dive
  under v5 Rule 1.
- `docs/_intake-2026-05-18-max-feature-status.md` — verbatim source
  for the 3 issue classes captured here.
