# AC-PLATECOMP — Ocean (temperate) BEFORE/AFTER for Max's UAT

**Date** 2026-07-30 · **AFTER = commit `3b4f1db`** (AC-PLATECOMP) · **BEFORE = `ae5c5a4`** (its parent)
**The call is Max's.** This file records what was captured and how, not a verdict.

## Why Ocean is the only body here

Of the 18 presets, only **Rocky (Earthlike)** and **Ocean (temperate)** reach the plate writer —
measured over 18 presets × 320 radii × 3 seeds, 0/960 cells for the other sixteen. Rocky **is** the
byte-identity anchor (its authored `R_core/R` equals `EARTH_CORE_RADIUS_FRACTION`, so its composition
factor is exactly 1). So Ocean is the entire visible surface of this change.

## How the A/B was isolated

`git show HEAD~1:planet-lod-lab.html > planet-lod-lab.BEFORE.html`, served from the same origin beside
the edited page. The two files differ by **exactly one statement** — the
`coreRadiusFraction: base.coreRadiusFraction` passthrough in `buildBodyDrivers` — and every module they
import is identical. Because the BEFORE page omits that passthrough, `driversToTune` falls back to
`?? D_EARTH.coreRadiusFraction`, giving a composition factor of exactly 1, i.e. the pre-AC-PLATECOMP
behaviour. Single variable, no working-tree juggling.

Both pages: preset Ocean (temperate), `detailSeed 1`, `radiusSeed 1` (⇒ drawn R = 0.8269 R⊕ on both),
`yaw 0.6 / pitch 0.25`, logical camera distance 3 planet-radii, animation clock **pinned to 0** via
`setAnimationClock(0)` — not merely frozen, because `freezeAnimation(true)` leaves the clock at whatever
value it had reached and F31 clouds read `uTime`, which would make any cross-page comparison meaningless.

Plate counts read live from `_lab.plateProbe()`, and the lab-side driver read back from
`state._lastBodyDrivers` to prove the passthrough is actually reaching the renderer:

| seed | BEFORE `coreRadiusFraction` | BEFORE plates | AFTER `coreRadiusFraction` | AFTER plates |
|---|---|---|---|---|
| 7 | *(absent → anchor)* | **7** | 0.506 | **6** |
| 1 | *(absent → anchor)* | **10** | 0.506 | **9** |

Both match the committed `../../plate-count-before-after.json` columns exactly, and the live lab matches
the headless table — so there is no lab/headless drift.

## Files

- `ocean-seed7-SIDEBYSIDE.png` — **start here.** 7 → 6 plates, the largest proportional change.
- `ocean-seed1-SIDEBYSIDE.png` — 10 → 9 plates, the subtler one.
- `ocean-seed{1,7}-DIFF.png` — amplified difference maps (×4 gain) showing *where* the surface moved.
- `ocean-seed{1,7}-{BEFORE,AFTER}-*plates.png` — the raw full-frame captures.

The side-by-side and diff images are cropped to a common centred 1180 px square. The two pages'
canvases differed by 2–4 px in height (window-chrome rounding that would not settle), which would
misalign a naive flip; cropping a centred box from each makes the pair identical in size with the disc
aligned. The raw captures are kept unmodified.

## What the captures show, as observations only

- Neither seed shows a **seam, hole, wedge, or unassigned region** — the removed plate's territory is
  absorbed by its neighbours and the partition closes.
- Belts did not flatten. At seed 7 the arc that ran through the mid-latitudes becomes **one longer
  continuous range** where BEFORE had a separate oval landmass north-east of it; the range reads more
  coherent, not mushier.
- Measured pixel change inside the crop: **34.1%** at seed 7, **25.9%** at seed 1 — consistent with a
  spherical Voronoi re-partitioning globally when one centroid is removed, and with the headless
  measurement of 35–57% of U nodes moving. Fewer plates ⇒ larger share moved, as expected.
- ⚠ **One delta worth Max's eye specifically:** at seed 7 the small cyan speckle cluster mid-right in
  BEFORE becomes a noticeably larger, brighter white patch in AFTER. That is the standing-water / lake
  field sitting in a basin whose shape changed. Plausible as a consequence rather than a defect — a
  larger, shallower basin holds more standing water — but it is the most eye-catching single difference
  and it is a judgement call, not something a test covers.

## Cleanup owed

`planet-lod-lab.BEFORE.html` is a temporary file at the repo root and **must be removed by exact name**
once the UAT call is made (it is untracked and must never be committed). Two browser pages are also
open in isolated contexts `ocean-before` / `ocean-after`; they are Max's to use and then close.
