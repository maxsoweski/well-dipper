# BOMBARDMENT-MAP — the `craterField` host channel (V2-5)

**Workstream:** `world-engine-v2-5-bombardment-2026-07-17` · **Slice 1 landed:** 2026-07-17
**Writer:** `src/worldengine/base/bombardment.js` · **Channel:** `carrier.craterField` (signed `Float32Array`, unhashed)

This is the `record-build-intent` note + the AC-0 named-consumer documentation for the crater-population
host channel. It is the sixth **editor-on-host** exemplar (after V2-4's shelfDepth / sediment / accommodation
/ province / figure).

## Function (plain language)

`writeBombardment(carrier, condition, { macroSeed })` paints the pockmarked surface of an **airless,
geologically dead, cold** world — the Moon / Mercury / Frozen look. On such bodies nothing (atmosphere, tides,
volcanism) erases impacts, so a whole history of bombardment accumulates as a **power-law crater population**:
a few giant basins over a battered small-crater texture, each crater a bowl with a raised rim and a low ejecta
apron. It writes ONE new per-node channel, `carrier.craterField`, a **signed displacement in the same
normalized-height units as `carrier.height`**: negative in a bowl, positive on rim/ejecta, zero on
un-cratered ground and on every non-target body.

## Pipeline position

- **Written** post-dispatch in `writeBodyRelief` (the V2-4 §0 IIFE seam), one universal call alongside
  `writeAccommodation` / `initSedimentHost` / `writePassiveMargins` / `writeProvince`. It **self-gates** on
  condition scalars (`isImpactSurface`: airless-or-thin ∧ dead ∧ cold) — fires on Frozen, Crystal, Mars,
  Moon/Mercury; all-zero elsewhere. Reads ONLY condition scalars (`surfaceGravity`, `age`, `atmosphere`,
  `T_eq`, `rawTidalIoRatio`) + `carrier.verts/adj` + its own `alea('bombard:'+seed)` stream. It reads **no
  geodynamic tuple, regime, composition class, archetype, or label** and imports **no derived-dispatch
  module** — so the E1-blind shadow-audit passes by construction.
- **Composited** by `route()` at render (SLICE 2): `compositeMargins` will sum `height + shelfDepth +
  craterField` so the crater relief displaces AND reshades (recomputed gradient). `carrier.height` is **never**
  mutated — the 75-golden byte-identity holds (craterField is outside `HASHED_FIELDS`; byte-inert by
  own-channel + independent-alea-stream + `route()`-only composite).
- **Edited** later by the #6 epoch editor (floor-fractured craters; mare flooding): it thresholds
  `craterField[i] < FLOOR_CUT` to locate basin floors and mutates `craterField` in place, source `height`
  untouched — the editable-host contract shelfDepth proved. The soft `tanh` saturation preserves node
  ordering so the threshold still works.

## Named consumers (AC-0 ch.2)

1. `route()` → `compositeMargins` (SLICE 2) — the render composite.
2. The lab `✦ current` summary + dropdown (SLICE 3) — reads the live carrier field, label-free.
3. The #6 epoch editor (future) — the host it edits.

## Deliberate non-goals (this increment)

- **No per-basin `craterId` map** — the thresholdable signed displacement is sufficient to de-risk the #6
  editor (a per-basin ID map is a basis-level bar, parked).
- **Ejecta rides as displacement-shaded brightness**, not a dedicated albedo attribute — a real albedo
  attribute would touch the atmo-shared planet geometry (out of fence). Deferred.
- **Atmospheric shielding deferred** (Max Q5) — targets are airless/thin.
- **Crater-vs-volcano visual distinctness is NOT a criterion** (Max Q4) — volcano legibility is V2-7/V2-8.
- **Legacy F2/F3 in-shader crater synth untouched** (LANDMINE #5).

## Calibration (constants pinned by committed evidence, 2026-07-17)

`docs/WORKSTREAMS/world-engine-v2-5-bombardment-2026-07-17/calibration/` (all ALL PASS):
`crater-scale.mjs` (size band + normalized-height amplitude + profile shape), `crater-powerlaw.mjs`
(B_SFD 2.0, differential dN/dlogD fit), `crater-drivers.mjs` (MULTIPLY exponents + L-crossover + saturation),
`crater-gate.mjs` (gate thresholds; exactly four targets fire). Deviations from the BUILD-PLAN are recorded in
its §10 (D1 rim height, D2 saturation, D3 SFD fit population, D4 profile continuity, D5 direct-schedule metric).
