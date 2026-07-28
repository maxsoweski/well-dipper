# `worldengine`

The L1 history-writing engine: derives each body's geology/atmosphere end-state from its
condition vector (D1–D16 drivers), then hands fields to the render to *express*
("render expresses, procgen decides" — the
[architecture spine](../../FEATURES/world-engine-architecture-spine.md)).
**Lab-only by charter until V2-10** (the
[planet-LOD charter](../../FEATURES/planet-lod-CHARTER.md)); the game screensaver still uses
its own `_pickType` path until the port.

## Purpose

One shared convective root, three lid-couplings (broken/unbroken/icy), exogenic overlays,
and a parallel atmosphere family — dispatched by **derived conditions, never labels**
(the condition-first re-founding; program map:
[`ROADMAP-v2-condition-first.md`](../../WORKSTREAMS/world-engine-history-program-2026-06-27/ROADMAP-v2-condition-first.md)).
Production dispatch is `writeBodyRelief` in `planet-lod-rivers.js` (repo root — outside
`src/`, listed here for orientation, not claimed): the condition-bearing branch resolves a
relief writer through a 9-way rule chain, then runs the V2-4 shared-substrate post-passes
(accommodation → sediment host → margins (plate) → province → figure descriptor; records:
[`SUBSTRATE-MAP.md`](../../WORKSTREAMS/world-engine-v2-4-substrate-2026-07-14/SUBSTRATE-MAP.md)).

## Module(s)

- `src/worldengine/base/e1Regime.js`
- `src/worldengine/base/adaptL0.js`
- `src/worldengine/base/baseStep.js`
- `src/worldengine/base/mathutil.js`
- `src/worldengine/base/verify.js`
- `src/worldengine/base/plates.js`
- `src/worldengine/base/shellRelief.js`
- `src/worldengine/base/magmatism.js`
- `src/worldengine/base/stagnantLid.js`
- `src/worldengine/base/lidResponse.js`
- `src/worldengine/base/mixedInterior.js`
- `src/worldengine/base/interpenetration.js`
- `src/worldengine/base/tectonic.js`
- `src/worldengine/base/lidDisruption.js`
- `src/worldengine/base/sphereField.js`
- `src/worldengine/base/substrate.js`
- `src/worldengine/base/hostChannels.js`
- `src/worldengine/base/stressFabric.js`
- `src/worldengine/base/passiveMargins.js`
- `src/worldengine/base/province.js`
- `src/worldengine/base/bodyFigure.js`
- `src/worldengine/base/bombardment.js`
- `src/worldengine/base/reliefBudget.js`
- `src/worldengine/base/climate-e5.js`
- `src/worldengine/base/emission-e.js`
- `src/worldengine/base/fieldViz.js`
- `src/worldengine/instrument/descriptors.js`
- `src/worldengine/instrument/stats.js`
- `src/worldengine/instrument/sampling.js`
- `src/worldengine/instrument/fieldSampler.js`
- `src/worldengine/instrument/sweep.js`
- `src/worldengine/instrument/laws.js`

*(Bare paths per Rule 14 — `doc-graph.js` parses this list strictly. What each module is:
regime selection = e1Regime/adaptL0/baseStep/mathutil/verify; relief writers =
plates/shellRelief/magmatism/stagnantLid + the lidResponse router, mixedInterior composer,
interpenetration instrument, tectonic despun path, and the deliberately-unwired
lidDisruption family module (V2-7d); shared substrate (V2-4) = sphereField/substrate
carriers + hostChannels/stressFabric/passiveMargins/province/bodyFigure — records in
[`SUBSTRATE-MAP.md`](../../WORKSTREAMS/world-engine-v2-4-substrate-2026-07-14/SUBSTRATE-MAP.md);
exogenic = bombardment (V2-5 crater schedule; inc3b added `craterRelevanceOf`, the
condition-derived crater/ejecta enable that replaced the preset-name `rendersOn` gate) +
reliefBudget (inc3b condition-pure f_I — reallocates composite relief variance so craters
dominate on impact surfaces, consumed by the lab's `compositeMargins`);
atmosphere family = climate-e5 (#3a), emission-e (#2), fieldViz harness;
**instrument/** = the non-visual analysis channel (2026-07-24) — READ-ONLY measurement, never a
writer: descriptors (hypsometry, slope, radial PSD / spectral-excess form size, crater SFD,
metric-exact drainage & boundary density, band count), stats (mean±SEM, weighted power-law fit,
three-valued PASS/FAIL/**UNRESOLVABLE** law verdicts), sampling (sphere geometry + the physical /
angular reporting frames), fieldSampler (live float-RTT readback via the rivers `createHeightSampler`),
sweep (N values × M seeds response curves + pre-flight ensemble sizing) — records in
[`nonvisual-analysis-channel`](../../WORKSTREAMS/nonvisual-analysis-channel-2026-07-24/).)*

## Tier(s) served

SCREENSAVER heart (distinct, history-coherent worlds per minute) — via the lab until the
V2-10 game port.

## Interface

- **Entry:** `writeBodyRelief(carrier, bodyDrivers, …)` (`planet-lod-rivers.js`) — requires a
  condition-bearing driver bundle (condition-less input throws; the PRESET_ARCHETYPE
  retirement, 2026-07-13).
- **Determinism contract:** alea namespaces disjoint per writer; no `Math.random`/`Date.now`;
  byte-identity pinned by `tests/v2-0-byte-identity.test.js` (75-golden) +
  `tests/worldengine-lid-byte-anchors.test.js`; conformance by
  `tests/worldengine-v2-3-dispatch-oracle.test.js`.
- **Rule 15:** every increment touching this system carries the spine-conformance AC-0
  ([SPINE-CONFORMANCE.md](../../WORKSTREAMS/world-engine-history-program-2026-06-27/SPINE-CONFORMANCE.md)).

---

*Authored 2026-07-14 at the V2-4 doc pass (the system predates this README; its absence was
a standing doc-rot backlog class — every `src/worldengine/base/*` file was unclaimed until
now).*
