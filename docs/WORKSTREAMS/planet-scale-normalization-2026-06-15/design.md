# planet-scale-normalization — design (real-units scale system for the lab)

> Brainstormed with Max 2026-06-15/16 (superpowers:brainstorming, run in-thread). This is the
> validated design behind `intent.md` + `contract.json`. Feeds the dev-collab contract (the
> project's build/verify artifact) — NOT a separate writing-plans plan.

## Origin & reframe

Theme B of the LOD-lab quality backlog started as "normalize feature footprints to body size."
Two findings reshaped it:

1. **The game already varies size by archetype + seeded random and renders proportionally** —
   `PlanetGenerator.generate()` has `radiusRangesEarth` (18 types) and draws
   `radiusEarth = rng.range(...range)`, then `radiusScene = earthRadiiToScene(radiusEarth)`.
   So "planets should actually vary in size" is, in the shipped game, already done.
2. **The lab is the outlier** — 23 fixed presets, each one hard-coded `radiusEarth`, rendered
   normalized-to-view. Size is thrown away, which is why nothing varies there.

Max's target (chosen): **bring the lab up to size-awareness**, reusing the game's size model;
game renderer untouched. And his framing of *how*: keep free camera control, but build a real
**scale system** into the lab so planet size and feature size are both first-class, real-unit,
controllable quantities — "control for the size of the planets and the size of the features."

This collapses the original three levers (footprint, animation-rate, gravity-relief) into one
idea: **everything is expressed in real units (km); `deriveUniforms` converts real units →
the shader's unit-sphere uniforms given the planet's real radius.**

## The model

### Three real-unit quantities (dialable + readouts)
- **Planet radius** — `radiusEarth` (shown as RE *and* km; Earth = 6,371 km).
- **Feature horizontal size** — per footprint feature, a characteristic size in km (crater
  diameter, river-network spacing, lava-cell width, canyon length, facet width, ecumenopolis
  district size, dune wavelength, karst-doline spacing, etc.).
- **Feature relief height** — per vertical feature, a height in km (crater depth, edifice/mountain
  height, canyon depth).

### Conversion (in `deriveUniforms`, per feature)
Let `radius_km = radiusEarth * 6371`.

- **Footprint → shader frequency:** `frequency = C_feature * radius_km / featureSize_km`.
  Bigger planet at fixed feature-km ⇒ higher frequency ⇒ features smaller-relative + more
  numerous. This is exactly "the bigger the planet, the smaller craters appear."
  `C_feature` is a per-feature calibration constant set to the **desired** look at the reference
  radius (calibration, not a new free parameter): features that already read well keep their
  current frequency; features Max flagged as oversized (#2 craters, #3 rivers) are calibrated
  **smaller** (a higher base frequency) so even an Earth-sized world no longer "looks small."
- **Relief → shader amplitude** (unit-sphere space, radius = 1):
  `amplitude = (featureHeight_km / radius_km)`, then clamped by the gravity cap below.
- **Gravity caps authored height:** `surfaceGravity = massEarth / radiusEarth²` (already computed).
  Max relief height is scaled by a bounded `reliefGravityFactor(surfaceGravity)` — high-g worlds
  cap lower (isostatic limit), low-g worlds (Mars/Titan) allow exaggerated relief (Olympus-Mons
  read). Monotonic-decreasing in gravity, bounded `[floor, ceil]` to avoid degenerate flat/spiky.
- **Animation rate → `rate = baseRate / radius_km`** (relative to a reference radius), so big
  worlds animate slower. Applies to lava breathing, glint shimmer, storm drift, aurora pulse.

The shader still runs on a unit sphere; **geometry, camera, and zoom are unchanged**. Only the
*uniform values* are now derived from real units instead of hand-set frequencies.

## Size source (per preset)
- **Default:** preset load → seeded draw from its archetype's `radiusRangesEarth` range → a real,
  varying radius (replaces the old fixed preset value for generic archetypes).
- **Reroll:** button + seed field redraws (same archetype, new size) — mirrors game seeding.
- **Manual override:** radius slider pins any value to "control for" it while tuning features.
- **Named real bodies** (Mars, Titan, Hot Jupiter, Venus, Europa, Magma K2-141b, …): default to a
  **canonical-size lock** (Mars stays 0.53) — their identity *is* their size — still overridable.
- Preset→archetype mapping: the 23 lab presets map to the 18 `radiusRangesEarth` keys.

## Fuzzy-feature handling (explicit modeling choice, not physics)
Some features lack a rigorous real-world size: **chaos rafts, shatter blocks, ecumenopolis
districts, sublimation pits**. Each still gets a km dial (uniformity), using a defensible
*characteristic dimension* (e.g. raft ≈ width in km), documented in-code as "representative, not
rigorous." Flagged so a future reader knows the km value there is a modeling choice.

## GUI + readouts
- Feature folders' primary scale knobs flip **frequency → km** (relabeled, real-world defaults).
- **Scale readout panel:** planet radius (RE + km), surface gravity (g), per-feature size (km).
- Existing per-feature GUI tweaks still override the derived defaults (helper sets defaults;
  manual override persists).

## Architecture & reuse
- **`radiusRangesEarth` extracted to `ScaleConstants.js`** (decision 5a) — it already exports
  `earthRadiiToScene` and is already imported by both the game generator and the lab. The game's
  `PlanetGenerator.generate()` imports it back (pure, zero-behavior move). Single source of truth,
  port-ready. Guarded by the existing generator test suite.
- **Conversion helpers in `deriveUniforms`** (`planet-lod-lab-core.js`; off-limits caution relaxed
  for this workstream) — `featureFrequencyFromKm()`, `reliefAmplitudeFromKm()`,
  `reliefGravityFactor()`, `animationRateFactor()`. Edits confined to the transform; gradient /
  voronoi3d / crater-shape math untouched.
- **Game renderer untouched** — `Planet.js` and the generate() body (beyond the import swap)
  unchanged. Lab already imports from `src/generation` (`generateRingPhysics`), so reuse is
  consistent with existing practice.

## Testing
- **Unit oracles (vitest):** km→uniform conversion monotonic + bounded; relief-gravity ordering
  across the 23 presets; seeded radius draw lands within the archetype range; named-body canonical
  lock; `C_feature` calibration keeps current presets near their existing frequency.
- **Live integration (:9223):** raising planet radius shrinks/multiplies craters; reroll varies
  size; relief responds to gravity (Mars/Titan exaggerated, high-g flat); lava breathing slower on
  big bodies.
- **Regression:** 17 presets render; render-audit false = 2 unchanged; vitest 36/36; backtick
  parity even; **game planet generation suite stays green** (the real guard on the 5a extraction).
- **UAT (Max only):** dial planet + feature sizes in real units; planets read at believable scale;
  nothing "makes the planet look small."

### Test-debt
- AC5 headless oracle deferred 2026-06-17 (Max-approved): size-source (drawPresetRadius /
  NAMED_BODY / archetype map) is inline in world-engine-lab.html, not vitest-importable. Verified
  live on :9223. Follow-up: extract to an importable module + add the in-range/canonical vitest
  oracle.

## Non-goals (explicit)
- No body-to-body on-screen size comparison view (lab inspects one body; camera stays free).
- No visible viewport scale gauge/ruler (Max chose real-units controls + readouts only).
- No change to the game's planet renderer or its generation behavior (only the constant moves).
- Game-port of the lab feature renderer remains the separate, deferred effort per the CHARTER.
