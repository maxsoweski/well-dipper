# Investigation — orbit-vanish mechanism + star-glow clamp (2026-07-20)

First build step per contract. Code exploration (opus agent) + live drives on :5173.

## Verdict: the vanish is 1/3-resolution rasterization aliasing

Orbit lines are `THREE.LineLoop` + `LineBasicMaterial` (1-px, opacity 0.8, `src/objects/OrbitLine.js:16-37`,
segments = max(128, ceil(sqrt(radius)*32))). They render into the retro pipeline's **sceneTarget at
ceil(screen/pixelScale), pixelScale default 3** (`RetroRenderer.js:31,764-765`; live-confirmed 594×283 vs
1780×848 canvas), NearestFilter, `antialias:false`, `setPixelRatio(1)`. A 1-render-px line with no
coverage AA goes dashed → gone once projected arc-per-render-pixel drops under ~1: rings drop out
**progressively, inner-first**, at ~3× the distance full-res would allow. The sky/star `bgTarget` is
FULL-res (`RetroRenderer.js:773`) — why stars stay crisp while orbits die.

Ruled out: scene.fog (none exists), opacity math (fixed 0.8, no distance term), explicit fades (none).
Secondary suspect only: default `frustumCulled:true` on big LineLoops (pan clipping, not distance).

Live corroboration (Sol, ORRERY): settled overview at 121,804u = 1.8×effOuter → 1,834 green orbit px in
sceneTarget; +1.2% distance → 1,118; further rungs decayed monotonically to 0 (second run 1,468→1,025→661→0).
**Deferred to AC5's isolated harness (deterministic): exact per-ring drop-out curve + the pixelScale 3→1
falsifier** (prediction: lines survive ~3× farther at pixelScale 1). Per `feedback_isolated-test-harnesses`,
that harness (standalone orbit-lab) is where mechanism-fix candidates get compared before touching prod.

## Star-glow clamp (the AC3 rule's denominator) — concrete

`src/objects/StarFlare.js`: billboard switch when camDist > `billboardSwitchDistance(camera.fov,
innerHeight)` (:339-355, :374-375); after switch, world size is recomputed per frame so projected size pins at
**targetPx = max(16, min(22, 16 + 6*(lumFactor-0.55)))** — floor 16px / ceiling 22px (:350); lumFactor =
clamp(0.7 + 0.2*log10(L), 0.55, 2.0) (:145). Star glow disc radius ≈ 8-11 screen px forever → the AC3
threshold compares the outermost planet's screen offset against THIS, not physical angular size.

## Distance math (AC4 anchors)

`_frameSystemForOrrery` (main.js:6371-6439): outermost pick sorts `planets[i].orbitRadiusScene` ascending,
breaks at first >5× gap; frame = `viewSystem(systemRadius*1.2, center)` × internal 1.5 = **1.8× outer**;
pitch 0.7; `maxDistance = max(50000, systemRadius*3)` set AFTER viewSystem (main.js:6436). ORRERY FOV = 70
(global), camera near 1e-9 / far 200,000 (main.js:130). Sol-under-test: effOuter 67,670 (13 orbit entries,
raw max == eff; no >5× break in this system).

## Drive gotchas recorded for the build's live checks

- `_lab.enterSol()` raw spawn leaves ALL 39 orbit lines `visible:false` in ORRERY (the mode sync never runs
  on the lab path) — orbit-visibility checks must enter via PRODUCTION paths (real warp / instant-cut), or
  force-set visibility explicitly and say so.
- Raw `cc.viewSystem(...)` bypasses `_frameSystemForOrrery`'s maxDistance override AND something per-frame
  (ship/boot plumbing) can retarget the controller after lab spawns — camera-distance ladders in the live
  game are unreliable; quantitative rasterization measurements belong in the isolated harness.
- Esc-cascade presses did NOT reach the handler this session after a synthetic chooser click (worked 7/17);
  frame via the production entry or `viewSystem` + explicit maxDistance instead of trusting Esc.
- Green-pixel counter (readRenderTargetPixels on sceneTarget, g>40 && g>1.5r && g>1.5b) works as the
  objective orbit-presence probe; sample only after settle-verified camera distance (mid-lerp reads produced
  false zeros twice this session).
