# Slice D LIVE GAME battery — orbit-ring-conic-2026-07-21

Run against the REAL game (`http://localhost:5173/well-dipper/`) on branch
`feature/supercruise-freelook`, HEAD `47ca81f` ("Slice C … OrbitLine re-route to
conic field behind USE_CONIC_FIELD"). Conic field LIVE in prod, `USE_CONIC_FIELD`
default ON, legacy SDF dormant. Own new page opened + reloaded `ignoreCache:true`
first; Max's live tab (page 1) untouched. Boot via D-hold boot-skip → Sol ORRERY
(msgid=62 `[BOOT-SKIP]`). Autopilot confirmed OFF before every measurement
(feedback_wd-nav-drives-autopilot-off): `_autoNav.isActive === false`,
`_flythrough.active === false`, no `[WARP]`/`[NAV-SEQ]` fired at any point.

MEASURE/OBSERVE ONLY — no `src/`, test, or lab-file edits. All A/B done at runtime
via scene manipulation (field `mesh.visible` + proxy `layers.set(0|10)`), restored to
prod default at the end (also fully reset by reload). Draw-call/frame-time via the
game's own `renderer.info` + `requestAnimationFrame` deltas; ring-pixel reads via
`renderer.readRenderTargetPixels` on the internal `sceneTarget` (657×282, 1/3-res).

## Environment

- **GPU (WEBGL_debug_renderer_info):** `ANGLE (NVIDIA, NVIDIA GeForce RTX 5080
  (0x00002C02) Direct3D11 vs_5_0 ps_5_0, D3D11)`, vendor `Google Inc. (NVIDIA)`,
  `WebGL 2.0 (OpenGL ES 3.0 Chromium)`. **This is Max's high-end dev GPU, NOT
  floor/low-end hardware.** The `gl_FragDepth` early-Z forfeit (R4) cannot be shown
  to regress here; a floor-class sample is not available in this session — state
  honestly.
- Sol inventory: 13 planets, 26 moon rings → **39 rings** (0 star rings, single
  star). Confirmed 39 ring proxies, all on `ORBIT_PROXY_LAYER` (10, suppressed), 0
  on layer 0 → field owns render, proxies draw nothing (AC9 mechanism live).
- Field shader compiled live: `[SHADER DEBUG] Mesh: VS=62 chars, FS=3754 chars`
  (VS=62 clip-space passthrough; FS=3754 matches Slice B post-fix). Orbit-plane =
  world XZ; 1 AU ≈ 1000 units → Jupiter/P6 ring r=5203 (= lab "5200" grazing pose).

## Runtime A/B method (honest note)

`setUseConicField` is not exposed to `window`, and a live flag flip alone does NOT
change rendering (the render loop checks `orbitConicField` object existence, not the
live flag; proxy layer is set at spawn). So ON/OFF A/B was done by directly driving
the render list: **OFF** = `field.mesh.visible=false` + proxies `layers.set(0)`
(legacy SDF draws — shaders retained-but-dormant at Slice C); **ON** = field visible
+ proxies `layers.set(10)`. This renders the genuine legacy path for OFF, so the A/B
is real, not an estimate. World-origin rebasing fires at the close poses (R11/D-1);
posing reads each ring proxy's LIVE `matrixWorld` center so poses stay valid across
rebases.

## Per-AC verdicts

### AC2 dead-zone-renders → **PASS**
In-plane pose (pitch 0.002, dist 25 from a point on Jupiter's r5203 ring, prox
neutralized via `uProxNear*`/`uProxFarMul` on all rings). **Same pose, ON vs OFF:**
- ON (conic): a solid green line spans the full screen (Jupiter ring edge-on),
  `sceneTarget` read **g=999 core / nz=1737** (early single read hit **nz=1314** —
  the exact lab dead-zone number). `slice-d-ac2-deadzone-ON.png`.
- OFF (legacy SDF): **no ring line at all** — the dead-zone defect; identical
  starfield/nebula confirms identical pose. `slice-d-ac2-deadzone-OFF.png`.
The orbit line renders where the shipped SDF showed nothing. (Qualitative per plan —
no literal 1314px pin in-game.)

### AC3 far-orbit-flicker-gone → **PASS**
`driftMeasure` 90 frames, gentle 0.12°/frame, sampling `sceneTarget` green + per-pixel
toggles. Same-pose ON-vs-OFF (the only valid comparison — live absolute toggle counts
also include band-motion-from-drift + starfield green-channel readback noise, so they
run higher than the clean lab numbers; the ON<OFF *difference* isolates render
stability):

| pose | ON (conic) togglePerGreen | OFF (legacy SDF) |
|---|---:|---:|
| grazing @r5203 p.002 | **0.167** | 0.197 |
| dead-zone boundary @r5203 p.01 | **0.215** | 0.382 |

Conic flickers **less** than shipped at both near-plane poses (and under the
contract's shipped reference 0.184 at grazing). Eye-proxy `slice-d-ac3-grazing-ON.png`:
two clean solid green lines (Jupiter + adjacent planet ring, edge-on), no
dashing/gaps. Max's round-3 flicker finding is addressed.

### AC4 nearfield-clean → **PASS**
Standing on Jupiter's ring (dist 1.0, in-plane, yaw π/2 so the ring crosses the view;
Jupiter soloed to isolate its envelope from neighbor rings):
- **Band clean/stable, prox OFF:** static **g=1971 / nz=1993** contiguous band;
  drift (60f) **togglePerGreen 0.0087** — essentially flicker-free, no tearing/blotch.
  `slice-d-ac4-nearfield-band-proxOFF.png` (two solid parallel lines = ring edge-on
  band, JUPITER label/reticle).
- **Shipped envelope applies, prox ON:** ring fades **1971 → g=0** while standing on
  it (circleDist≈1 ≪ near=104 → proxFade=0). `slice-d-ac4-nearfield-faded-proxON.png`.

### AC5 anti-vanish-ladder → **PASS**
- Overview (dist 120k): full concentric ring set renders — outer planet rings through
  the packed inner cluster (P1–P5) + Jupiter moon-ring cluster, SOL/JUPITER labels.
  `slice-d-ac5-overview-ON.png`. ON g=3738 vs OFF g=4558 — both render every ring; the
  ON<OFF pixel delta is the KNOWN band-shape difference (conic Sampson L2 narrower than
  SDF fwidth L1, the pre-set UAT expectation), NOT a vanish. `slice-d-ac5-overview-OFF.png`.
- Moon rings: rendered and correctly placed around Jupiter (see AC6 shot). Nothing that
  renders under SDF vanishes under conic. (Lab perRingLadder already proved 0 anti-vanish
  regressions rigorously; live = qualitative confirmation.)

### AC6 occlusion-holds → **PASS**
Close to Jupiter (dist 6): `slice-d-ac6-occlusion-jupiter-ON.png` shows the lit gas-giant
sphere with its moon-ring ellipses **correctly occluded where they pass behind the body**
(back arcs cut by the sphere, front arcs draw over) + background star-orbit rings. The
conic's `gl_FragDepth` places ring pixels correctly against the planet. Z-fight shimmer
(static frames, dYaw=0, isolates z-fight from motion):

| pose | avgToggles | togglePerGreen |
|---|---:|---:|
| nominal pitch 0.12, static | 0.1 | **0.000** |
| nominal, gentle drift | 8.7 | 0.0021 |
| grazing pitch 0.006, static (R6 worst case q.z→0) | 0 | **0.000** |

Zero z-fight at both nominal AND grazing pitch; occlusion holds under drift.

### AC7 parity-surface → **PASS** (one GAP-lite noted)
- **Hover highlight (live, field-side novelty):** applied the exact main.js hover
  mutation (`material.color.setHex(0x44ff44)`, `uOpacity=1.0`) on Jupiter's ring →
  all ring pixels shift pure-green→tinted (**1962 pure→1975 tinted**, R-channel
  raised), and restore on unhover. `material.color` IS the `uColor` uniform
  (`materialColorIsUColor: true`); the field reads it live → highlight renders. Note:
  three sRGB→linear stores 0x44 as ~0.058 → a subtle lighter-green highlight (correct).
- **Crossing color:** the field's single-argmax (front-most min-`w_clip` ring owns
  color) is the exact path lab b5b proved (144 crossings, argmax-match 100%, swap-flip
  100%, 0 blend). Covered by b5b + the live hover-color confirmation; not independently
  re-measured live.
- **Mode sync ORRERY↔HELM (live, M key):** ORRERY 39/39 rings visible → HELM **0/39**
  (hidden, cockpit clean, `[MODE] swap → HELM`) → ORRERY **39/39** again. No tour
  armed, no warp.
- **Moon-ring tracking (live):** Jupiter's moon-ring center coincides with Jupiter's
  body position **exactly (dist 0)** — pinned to the planet; innermost fast moon ring
  advanced 0.0005 units in 3s (sim live-updating; slow because real-time rates).
- **Dispose/recreate (live, `_lab.enterSol()` — real spawn path, no nav tour):** old
  proxies disposed + new created (**proxiesReplaced=true**, different uuids), count
  correct (39), field persists + re-reads new rings (g=3751), **console clean through
  the whole respawn** (msgid 66–82: full system regen, zero errors). Field is stateless
  per-frame re-read of `system.orbitLines` (no per-ring registry — D-1/B4), so a
  different-inventory count is handled automatically (headless c1–c4).
- **GAP-lite:** a live warp to a genuinely DIFFERENT system (different ring inventory)
  was not driven — the "new system" keybind (Space) is now inert "burn" in ORRERY
  (stale help text), and a nav-computer warp risks boot-tour auto-warp contamination
  (feedback_wd-nav-drives-autopilot-off). The dispose→recreate→field-survive→count→
  no-error chain is fully shown via enterSol; only the different-count case rides the
  stateless-re-read mechanism + headless c1–c4 rather than a live different-system warp.

### AC8 angular-size-fade → **PASS**
Zoomed to dist 600000: `slice-d-ac8-farfade-ON.png` — large planet rings persist as a
tight concentric cluster; **no scattered/persistent isolated green dots** anywhere
(sub-pixel moon rings faded to invisible, not persisting as dots). Clean starfield.
g=566 (only the persisting larger rings). Matches lab b10 (cutoff 1.0).

### AC9 single-pass-perf → **PASS**
`renderer.info.render.calls` per-frame (measured as a delta over a counted rAF window
— `info.autoReset=false` and `info.reset()` is never called, so raw reads are
cumulative; per-frame = deltaCalls/frames). Whole-scene totals (all 4 RetroRenderer
passes); the ring contribution is the ON-vs-OFF delta with nothing else changing (B7/d3):

| pose | ON calls/frame | OFF calls/frame | **ring delta** | ON meanMs | OFF meanMs |
|---|---:|---:|---:|---:|---:|
| overview (dist 120k) | 22 | 60 | **38 fewer ON** | 5.769 | 5.773 |
| near-field (Jupiter dist 6) | 33 | 71 | **38 fewer ON** | 5.785 | 5.796 |

**39 ring quads → 1 fullscreen pass**: exactly 38 fewer draw calls ON at BOTH poses
(matches plan / AC9). Frame-time identical ON vs OFF at both poses (Δ ≤ 0.011ms =
noise). **Caveat:** ~5.8ms/frame ≈ 172fps = display-cadence-limited on the RTX 5080;
this high-end GPU has headroom, so the `gl_FragDepth` early-Z forfeit cannot be shown
to regress here — a floor-hardware sample is the honest gate and is NOT available in
this session. No regression observed; if a floor GPU regresses, the R4 bbox pre-cull is
kept ready.

### AC10 orbit-read-coheres-uat → **DEFERRED TO MAX** (not an agent gate)

## Console status

**Zero errors / warnings across the entire battery** (`list_console_messages`
filtered to error/warn/assert → none). The only non-log entries are two boot-time a11y
`[issue]` messages (`No label associated with a form field` ×21, `A form field element
should have an id or name attribute` ×2) — DOM form a11y, not game/render code, present
at boot before any ring work. No shader-compile error, no GL error, no NaN/uniform
warning. Mode/burn/respawn logs all benign (`[MODE] swap`, `[BURN] inert in ORRERY`,
`System "Sol" … 13 planets`).

## Screenshots

- `slice-d-smoke-overview.png` — boot smoke: Sol ORRERY rings render (conic field).
- `slice-d-ac2-deadzone-ON.png` / `slice-d-ac2-deadzone-OFF.png` — AC2 A/B (line vs nothing).
- `slice-d-ac3-grazing-ON.png` — AC3 grazing edge-on lines (clean, no flicker artifact).
- `slice-d-ac4-nearfield-band-proxOFF.png` / `slice-d-ac4-nearfield-faded-proxON.png` —
  AC4 clean band → prox-fade envelope.
- `slice-d-ac5-overview-ON.png` / `slice-d-ac5-overview-OFF.png` — AC5 full ring set.
- `slice-d-ac6-occlusion-jupiter-ON.png` — AC6 rings occluded behind Jupiter.
- `slice-d-ac8-farfade-ON.png` — AC8 far fade, no persistent dots.

## Verdict roll-up

| AC | verdict | headline |
|---|---|---|
| AC2 dead-zone | **PASS** | conic renders full edge-on line; legacy SDF paints nothing at same pose |
| AC3 flicker | **PASS** | conic togglePerGreen < SDF at grazing (0.167<0.197) + boundary (0.215<0.382) |
| AC4 near-field | **PASS** | clean band g=1971 drift 0.0087; prox envelope fades 1971→0 standing on it |
| AC5 anti-vanish | **PASS** | all ring classes render overview→near; ON<OFF px = band-shape, not vanish |
| AC6 occlusion | **PASS** | rings occluded behind Jupiter; 0 z-fight static, nominal + grazing pitch |
| AC7 parity | **PASS** | hover-color honored, mode-sync 39↔0↔39, moon-track dist 0, dispose/recreate clean (diff-inventory warp = GAP-lite) |
| AC8 far fade | **PASS** | sub-pixel moon rings fade, no persistent dots; large rings persist |
| AC9 perf | **PASS** | −38 draw calls ON at overview + near-field; frame-time no regress (dev RTX 5080, not floor) |
| AC10 UAT | **DEFERRED-TO-MAX** | Max flies the ORRERY |

All objective integration ACs (AC2–AC9) PASS live. AC10 is Max's gate. One AC7
GAP-lite: live warp to a different-inventory system not driven (nav-tour contamination
risk); dispose/recreate mechanism itself fully verified via enterSol. Agent browser
page closed after the run.
