# Live AC drives — radius display-scale (2026-07-24)

Driven by working-Claude on the running :5175 dev server (build commit `5cef327`), one isolated
chrome-devtools page (`radius-scale-verify` context), closed after the session. Max's tabs untouched.
Console: **zero errors/warnings** across the entire drive.

## AC-SCALE-LIVE — PASS (law-exact)

Fixed wheel `state.distance = 20`, Rocky (Earthlike), radius via the slider path
(`state.planetRadiusEarth` + `applyDrivers()`):

| radius (RE) | sVis | disc bbox (px) | step ratio | expected (sVis ratio) |
|---|---|---|---|---|
| 0.5 | 0.7071 | 79 × 78 | — | — |
| 2   | 1.4142 | 163 × 162 | **2.063** | 2.0 |
| 8   | 2.8284 | 327 × 326 | **2.006** | 2.0 |

Strictly increasing, each step ≫ the ≥5% bar, and proportional to sVis within ~3% (79 px disc,
±1 px edge noise). Captures: `AC-SCALE-r0.5.png`, `AC-SCALE-r2.png`, `AC-SCALE-r8.png`.
Measurement: central-window (x∈[14%,80%], y∈[5%,95%]) luminance>18 bounding box — excludes both GUI panes.

**Re-roll half:** Moon/Mercury (impact-airless) preset; boot draw radius 0.27296 (sVis 0.5225) →
`rerollRadius()` draws 0.32238 / 0.28279 / 0.37501 — all in the [0.27, 0.38] band, moving every roll.
Disc width draw1 57 px → draw2 (r=0.37501, sVis 0.6124) 69 px; observed ratio **1.211** vs expected
1.172 (within edge noise at this disc size). Captures: `AC-SCALE-moon-draw1.png`, `AC-SCALE-moon-draw2.png`.

## AC-CLAMP (live half) — PASS

Radius 16 (sVis = 4.0 exactly), forced `state.distance = 1.1` (the old radius-1 wheel floor):
frame-loop clamp raised it to **4.4 > 4.2** (= sVis × 1.05 bar). Min-zoom screenshot
`AC-CLAMP-r16-minzoom.png`: continuous rendered surface fills the frame — no near-plane
clip-through, no void. (Unit half — clamp expression at radius extremes — covered in
`tests/planet-vis-scale.test.js`, 23/23 green.)

## AC-OVERLAY — PASS

Rocky at 2 RE (sVis 1.4142), `distance = 6`:
- Province overlay ON: colored province shell hugs the scaled disc exactly — clean circular limb,
  boundaries painted on-surface, no floating/detached shell (`AC-OVERLAY-r2-provinces-rivers.png`).
  (Overlay is a planet child — inherits sVis by parenting, as the BUILD-PLAN predicted.)
- Overlay OFF, rivers ON: ribbon systems ride the terrain on-surface; the haze rim (scene-space
  shell, explicitly sVis-scaled per the lens fix) hugs the limb (`AC-OVERLAY-r2-rivers-only.png`).

## Notes for Max's UAT

- Known non-goal (in-contract): craters/terrain features scale WITH the disc — proportion to disc
  stays constant; the size cue is the disc itself.
- R1 flag (BUILD-PLAN): at non-1 sVis the re-keyed uLodRamp legitimately shifts live relief
  amplitude + cloud specks with apparent size — intended "detail tracks apparent size," judge at UAT.
- At 16 RE min-zoom the view is a wall of surface (camera at 4.4 units from a 4.0-unit sphere) —
  by design; wheel out to frame the disc.
