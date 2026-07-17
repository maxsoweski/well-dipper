# SUBSTRATE-MAP — the V2-4 shared-substrate fields (clean records)

> **Why this file exists (Max's condition, scope interview 2026-07-14):** *"That's fine if
> it's plumbing so long as we have clean records specifying function and where it lives in
> the procgen/rendering pipeline."* One record per field: **function · pipeline position ·
> named consumers · deliberate non-goals.** Contractual under AC-DOCS.
>
> **The shared seam (all five ride it):** `writeBodyRelief`'s condition-bearing branch
> (`planet-lod-rivers.js`, the `if (bodyDrivers?.condition)` block) resolves the relief
> writer through a 9-way rule chain captured in an inner IIFE; after it returns —
> `carrier.height` finalized on **every** dispatch path — the post-dispatch writes run
> **once**, in this order (order between accommodation→province is load-bearing;
> margins/figure are order-independent):
> `writeAccommodation(carrier)` → `initSedimentHost(carrier)` →
> `writePassiveMargins(...)` *(plate path only, `relief.plateDiag`-guarded)* →
> `writeProvince(carrier, {seed})` → `relief.figure = deriveFigureDescriptor(cond)`.
> In spine terms (write-history → read-history, spine §4c/§1): these are **L1
> write-history post-passes** over the finished endogenic height; the render (L2) only
> *reads* them. None of the five writes any golden-hashed field
> (`HASHED_FIELDS = height/grainAngle/grainMag/regime/faultDensity`) — the whole increment
> is byte-inert at the 75-golden and the lid byte-anchors by construction.

---

## 1. `carrier.accommodation` — deposition sink-ranking *(deliverable b, slice C1)*

- **Function:** ranks every node as a deposition sink on [0,1] — 1 = the deepest basin,
  0 = at/above the reference datum. `clamp01((refDatum − height[i]) / depthScale)` with
  `refDatum` = the 60th-percentile height and `depthScale = refDatum − min(height)` (the
  deepest sink maps to exactly 1 on every world, no magic constant). Deterministic, RNG-free.
- **Pipeline position:** written once at the shared seam, immediately after the relief
  writer finishes — it reads **finished** `carrier.height` (verified byte-exact against an
  independent reimplementation). Universal: every dispatch path.
- **Consumers:** `writeProvince` (the *basins* class reads it — live now); **V2-8
  sculpting** (deposition sink-ranking); **V2-7 epochs** (input to the volumetric budget).
- **Non-goals:** **no mass conservation / volumetric claim** — it is a *ranking*, not a
  budget; the budget belongs to V2-7 (ROADMAP V2-4 fine print). It is NOT E9's
  `baseLevel` (that channel stays allocated-and-unwritten, reserved).

## 2. `carrier.sediment` — deposition host *(deliverable b, slice C1)*

- **Function:** the host array deposited material will live in. V2-4 ships it **zeroed**
  (pristine bedrock) so downstream increments have a real, tested seam instead of inventing
  a channel mid-build.
- **Pipeline position:** zero-filled at the shared seam (`initSedimentHost`, idempotent);
  the `// V2-8 SEAM:` comment in `hostChannels.js` marks where deposition will write.
- **Consumers:** **V2-8 sculpting** (deltas/fans/infilled basins deposit here); **V2-7
  epochs** (the volumetric budget moves material through it).
- **Non-goals:** **V2-4 deposits nothing.** It is NOT E9's `maturity`.

## 3. SP-STRESS-FABRIC — `src/worldengine/base/stressFabric.js` *(deliverable d, slice C2)*

- **Function:** the one owned copy of `steeredNoise3` — steered anisotropic (optionally
  ridged) noise, the fabric primitive every lineament/grain/tessera texture is built from.
  Formerly four verbatim module-private copies; now a single import, **proven bit-identical
  at all four call sites** (pre-extraction fixtures regenerated independently from a
  detached-HEAD worktree — byte-for-byte).
- **Pipeline position:** a *module*, not a carrier channel — called inside the relief
  writers themselves (L1, during history-writing): `tectonic.js` grain (regime-boolean
  adapted, bit-identical), `shellRelief.js` ridge/trajectory, `mixedInterior.js` +
  `stagnantLid.js` crossed fold+ribbon tessera fabrics.
- **Consumers:** the four writers today; **V2-7 CYCLE-2** keys gen-1/gen-2 lineament
  generations on this shared vocabulary (the extraction is what makes "same fabric, offset
  by the figure" expressible).
- **Non-goals:** no carrier-persisted stress field (each writer's fabric stays private and
  discarded, exactly as before); zero behavior change (the goldens are the witness —
  `grainAngle` is fabric-derived and 83/83 held).

## 4. `carrier.shelfDepth` + the margin composite — `src/worldengine/base/passiveMargins.js` *(deliverable a, slice C3)*

- **Function:** passive continental-margin bathymetry — a shelf → shelf-break → slope →
  rise depth apron written at continent/ocean transitions that are **not** plate-motion
  boundaries (the writer reconstructs belt stress itself from exported
  `boundaryStress`+`adj`; `plates.js` is unedited). Constants are **calibration-probe
  outputs** (`calibration/margin-scale.mjs`), converted from the v1 physical anchors
  (~80 km shelf, ~140 m break, 3° slope, ~500 km rise). Driver-responsive:
  `shelfWidthFactor(volatileFraction)` widens/narrows the shelf monotonically (isolated
  from the continental-repartition confound — fixed partition/seed in the sweep).
- **Pipeline position:** written at the shared seam on **plate worlds only**
  (`relief.plateDiag`-guarded). The render coupling is a **route()-local composite**:
  `compositeMargins` returns `height + shelfDepth` as a NEW array feeding the height-cube
  bake and the router re-point, with the gradient **recomputed from the composited
  surface** — `carrier.height` is never mutated, so the goldens never see it.
- **Consumers:** the coastline render (live now — AC-LAB/AC-UAT surface); **V2-8
  sculpting** (estuarine/coastal keying reads the margin).
- **Non-goals:** active margins stay `plates.js`-owned (convergent/divergent relief
  untouched). **Known render reality (surfaced pre-UAT):** shelf/break/slope zones
  (≤1.08°) are sub-node at practical mesh resolution — the visible read is a smooth graded
  coast→abyss apron dominated by the rise; the four-zone morphology lives (and is tested)
  in the mesh-independent profile function.

## 5. `carrier.province` — history-tied E12-province *(deliverable c, slice C4)*

- **Function:** whole-disk k=3 classification — **craton** (stable, low fault density) /
  **orogen** (belted, high grain magnitude) / **basin** (high accommodation) — from
  rank-normalized `faultDensity` / `grainMag` / `accommodation` (degenerate fields
  auto-dropped: plate worlds have all-zero `grainMag`, so fault+accommodation carry them),
  smoothed by a bounded 3-pass majority relax into contiguous, legible regions.
- **Pipeline position:** written at the shared seam after `writeAccommodation`
  (load-bearing order — it reads accommodation). Universal: every dispatch path gets
  provinces. The lab **debug overlay** is a *separate* ground-owned `THREE.Mesh` on its own
  `BufferGeometry` (flat 3-color material, default OFF) — it adds no attribute to the
  shared planet geometry and edits no line of the shared shader (the atmosphere-lane fence).
- **The honesty instrument (AC-PROVINCE-ASSOC):** `provinceAssociation` (mean η²) scored
  against a **contiguity-preserving spatial null** — 200 blob-scale-matched position-noise
  partitions, NOT a label shuffle (a shuffle-null would let any blobby noise province pass
  on spatially autocorrelated fields). Real provinces clear the null's p99 on all 25
  preset×seed cells (η² 0.23–0.62 vs p99 0.04–0.17); position-noise controls and two
  independent cheat constructions (blurred-random, latitude-bands) are all rejected.
  Thinnest margin (Mars, +0.11) is printed by `calibration/assoc-null.mjs`, not hidden.
- **Consumers:** **V2-9 palette/inhabitation** (palette derives from province there — the
  program's anti-"bag of overlays" guard); the lab overlay + `_lab.provinceProbe` (live).
- **Non-goals:** the shader's noise-based `gProvince` is **NOT rewired** here — that
  rewiring is V2-9's job; the overlay is a debug view, taxonomy-exempt (not a `PROVINCES`
  entry).

## 6. `relief.figure` — E2-figure descriptor — `src/worldengine/base/bodyFigure.js` *(deliverable e, slice C5)*

- **Function:** the planet's rotational figure, **originated from drivers**:
  `f = (5/4)·ω²·a/g` with ω from D8 `rotationHours` (newly plumbed into the condition
  vector), `a` = **body radius** (never `shellThickness` — grep-denied; the ROADMAP §7b
  triple-duty trap), `g` from `surfaceGravity`. Tidally-locked bodies split
  `fPresent ≠ fFossil` via the named `PRIMORDIAL_SPIN_HOURS = 8` fiducial — the
  despun-fossil-bulge. Magnitudes verified by hand-arithmetic (Earth ~4.8e-3 at the
  preset's 0.9g; Jupiter ~0.11; fossil/present ratio exactly (24/8)² = 9.0).
- **Pipeline position:** a **return-object field** (`relief.figure`), not a carrier array —
  derived at the shared seam on every dispatch path, pure function of the condition vector,
  RNG-free, byte-inert (delete-twin proven).
- **Consumers:** **V2-7 CYCLE-2** (the epoch model offsets gen-2 lineaments from
  fossil-vs-present figure — the stub test proves the seam: `Δgrain = K·(fFossil−fPresent)`,
  nonzero for despun, zero for stable-spin).
- **Non-goals:** **no render** — visible oblateness is a parked, separate later item (the
  fixed-sphere pipeline cannot express body shape; building that path collides with the
  atmosphere branch's shader territory). The (5/4) homogeneous coefficient overestimates
  Jupiter ~2× **by design** (ordering is the gate; Darwin–Radau refinement deferred).
  `shellRelief`'s seeded random spin axis (`'shell:axis:'`) is a red herring — sibling-local,
  untouched, and unrelated to this descriptor.

---

*Slice commits: C1 `c1e95f1` · C2 `015dbb5` · C3 `9f91a5e` · C4 `54bd357` · C5 `c158d22`.
Deviations: BUILD-PLAN §11. Calibration evidence: `calibration/*.mjs` (all constants are
probe outputs, verifier-rematched). Written 2026-07-14 at the increment doc pass.*
