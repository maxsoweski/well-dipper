# BUILD record — world-engine-plate-uplift-field-2026-06-26 (Option C, increment 1)

**Line of sight:** baked relief → "a planet that IS its own billions-of-years history" → the LOD-lab
renderer → the SCREENSAVER heart. This increment places the missing **Stage 1** (plate/uplift structure)
so the erosion WD already owns has something coherent to drain — rivers carved where the World-Engine
procgen says they should be.

## What was built (plain language)

A **one-pass, deterministic plate/uplift-field generator** for Earth-like bodies, feeding the existing
bounded erosion, built + verified **in the lab** (game `Planet.js` port is a later increment).

1. **`src/worldengine/base/plates.js`** (NEW, three-free — `alea` + `simplex-noise` + `mathutil` only,
   never imports THREE). `writePlateUpliftSphere(carrier, drivers, {macroSeed})`:
   - seed N plate centroids (N = 7–13, varies with `macroSeed`) → **spherical-Voronoi** partition
     (boundaries domain-warped for natural margins) → per-plate rigid **Euler-pole** motion
     `v(p)=ω·(w×p)` → classify each boundary **convergent / divergent / transform** by relative-motion
     stress (with an **obliquity attenuation** so oblique-convergent margins still build attenuated
     ranges, not zero) → write an uplift field **U** (high at convergent boundaries, negative at
     divergent, low/flat in cratonic interiors; continental plates ride higher than oceanic) → spread
     inward by a **resolution-independent geodesic** distance field (belt width in radians, not hops) →
     bounded **render-once** relaxation (fixed `RELAX_PASSES`, like `jacobiSmoothSphere`).
   - Writes `carrier.height = U` (**REPLACE** — the SOLE low/mid source for Earth-like bodies; additive
     would re-introduce the latitude banding this removes). Returns diagnostics for the tests + live probe.
   - Fully deterministic (all entropy via `alea` keyed on `macroSeed`; no `Math.random`/`Date.now`).

2. **`planet-lod-rivers.js`** (MODIFIED):
   - `isEarthlikePlatePath(archetype, locked)` + `writeBodyRelief(carrier, …)` — the **AC5 regime gate**
     at the route()/lab boundary (NOT inside the regime-agnostic base layer). Earth-like terrestrial/ocean
     → plate writer; every other regime → the existing despun `writeGrainSphere`+`writeHeightSphere`
     **byte-identical**. `route()` threads `archetype`/`locked` and retains the plate diagnostics.
   - `routeAndOrder(… , precipWeight)` — optional per-node discharge (line-489 `accum`); omitted ⇒
     uniform-1 **byte-identical**, supplied ⇒ linear in it (**AC4**).
   - `computeOcean(… , baseLevel)` — optional per-node base level; omitted ⇒ scalar seaLevel
     **byte-identical**, supplied ⇒ per-node thresholding (**AC4**).

3. **`planet-lod-lab.html`** (MODIFIED): threads the preset's archetype/locked into `route()`; adds
   `window._lab.plateProbe()` returning the objective live-integration signals (**AC7**).

## Intent / why these choices

- **Tier B now, built C-ready (AC3):** first-generation continents via one-pass placement + existing
  erosion. U is a swappable interface — a future Tier-C plate-*motion* pass writing the SAME
  `carrier.height` flows through erosion/carve with zero rework (no downstream branch on the U source).
- **Branch by regime (AC5):** variety is preserved by ADDITION, not replacement — icy/locked/etc. keep
  the despun shell that is the right physics for them.
- **No north-star debt (AC4):** discharge + base level are parameterized now (identity-safe), so the
  precip/climate increment drops in later with zero rework.
- **The bar is encoded as a test (AC2), not a hope:** the load-bearing anti-"eroded-noise" guard proves
  convergent-SPECIFIC uplift (base-elevation-subtracted tectonic signal; an independent label-derived
  boundary predictor; a boundary-generic control that provably CANNOT tell convergent from divergent).

## Deliberate NON-goals (named follow-ons, not abandoned)

- **Precip/climate field itself** (only the discharge/base-level seams are parameterized here).
- **Driver-response** — plate count/vigor/age reacting to `massGravity`/`tidalHeating`/`age`; `route()`
  doesn't thread the driver vector yet. This increment is **seed-only** variety (AC6).
- **Game `Planet.js` production-renderer port** (lab≠game by charter; isolated-harness-first).
- **Tier-C plate-MOTION stepping** (accreted terranes, sutures, worn belts).
- **Province-as-referent rewiring** (`gProvince` keying off U) — U is *structured* so it could later, but
  not rewired here.
- **Non-Earth-like regimes** as their own increments (kept despun byte-identical here).

## Verification
- Headless AC1–AC6: `tests/worldengine-base-plates.test.js`, `…-plate-structure.test.js`,
  `…-plate-variety.test.js`, `…-plate-regime-gate.test.js`, `planet-lod-rivers-discharge-param.test.js`,
  `planet-lod-rivers-swappable-uplift.test.js`. Built via per-AC implement→adversarial-audit→adjust; the
  AC1/AC2 core + the tectonics math were independently adversarially reviewed (findings folded in: the
  AC2 test was hardened for the base-elevation/self-correlation/straw-man-control gaps; the transform
  classifier was changed to attenuate rather than zero oblique-convergent uplift; the AC2 test resolution
  was raised so the geodesic belt is actually resolved).
- Live AC7 (working-Claude on :9223): see `live-integration-evidence.md`.
- AC8 UAT: Max alone.
