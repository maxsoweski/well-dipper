# Staticky-orbit fix — evidence record (2026-07-20, commit 140859f)

UAT round 1 finding (Max, verbatim): "seems like it works well, with the exception of
the orbit lines are all staticky when I navigate close to a planet."

## Root cause (instrumented, not inferred)

The ORRERY camera is **never still** — `autoRotateSpeed = 3` drifts yaw ~8.7e-4 rad
every frame (measured live), and player nav adds more. Close to a planet the camera
sits essentially **in the orbit plane** (measured cam y ≈ −0.0001 at close-Jupiter
focus), so for the planet's own orbit ring `fwidth(g)` explodes and the shader's
0.4R grazing clamp turned the ~1-px band into a **wide dim world-space smear**. The
smear's long soft alpha level-sets crawl perpetually under the auto-rotate drift —
prod-measured per-pixel green ramps 102→95→84→71→55→39→23→11→2→0 over ~10 frames.
Secondary source: the hardcoded 1.0-px smoothstep feather kept ~half the band's
painted pixels in intermediate-alpha states (crawling soft blocks) — a visual
texture the old crisp binary LineLoop never produced.

Why round 1 saw it and no one saw it before: the old LineLoop **vanished** at close
range (the very AC5 bug this workstream fixed), so its close-range temporal behavior
was never visible.

### Disproven candidates (evidence, not opinion)

- **Depth contest vs planet meshes as the static source** — lab 2×2 matrix
  ({LineLoop, SDF} × {log-depth planet stand-in on/off}): planet presence changed
  toggle counts by <2%.
- **AC3 fade factor** — factor = 1 close-in by the rule's shape (fade engages
  zoomed OUT, when rings shrink toward the star glow).
- **Orbital body motion** — bodies are static in settled ORRERY (angular rate
  measured 0).
- **Composite quantization/dither** — none in RetroRenderer composite (palette 0
  passes through; "each object handles its own dithering").

## The fix (`src/objects/OrbitRingSDF.js`, alpha-side only)

1. **Smear cut (threshold-free):** discard fragments that fail the *unclamped*
   screen-px band test `|g|/fwidth(g) > 0.5·width + feather`. The 0.4R clamp may
   only *stabilize* alpha inside the true band — never *widen* coverage. True
   horizon arcs and distant tiny rings pass the raw test (that is why they are
   visible at all) and keep rendering. A first draft used a gated aaRaw/R
   threshold cut — **perRingLadder caught it deleting legitimate horizon arcs at
   d/R ≈ 0.1** (5200@500, 19100@2000, 67670@8000); the threshold-free form has
   zero ladder regressions.
2. **`uFeatherPx` knob, default 0.5 (was hardcoded 1.0):** halves the crawling
   mid-alpha skirt; edges pop near-crisply (retro-consistent). 0.25 measures lower
   churn still but its worst-case diagonal coverage margin (0.707 vs 0.75 px) is
   too tight to ship blind — it stays a knob.
3. **`logdepthbuf` shader chunks:** the renderer runs `logarithmicDepthBuffer`;
   every other custom ShaderMaterial in the scene includes the chunks
   (WarpPortal/RingRenderer/Moon). The SDF band was writing standard NDC depth
   (~0.9999 at ORRERY scales) against planets' log depth (~0.62) —
   incommensurable, so ring-vs-planet occlusion was wrong. Regressed in the AC5
   swap when OrbitLine stopped being a built-in material. Post-fix screenshot
   shows the near ring segment correctly drawing IN FRONT of Jupiter's disc.

## Lab changes (`orrery-orbit-lab.html`)

- **LineLoopRing baseline replica** (byte-faithful from git 7e8b0ef): since the
  AC5 prod swap `OrbitLine` *extends* `OrbitRingSDF`, so the lab's baseline mode
  was silently measuring SDF vs SDF (caught by drift numbers identical to the
  decimal).
- **`driftMeasure` temporal instrument**: camera drift + per-frame symmetric
  difference of the green-pixel set (the objective "static" measure), with a
  log-depth-correct planet stand-in (`planet: true`).
- **`setSdfConfig`**: runtime knobs (pixelWidth, featherPx) for A/B.

## Numbers (final form, defaults width 1.0 / feather 0.5)

| scenario | metric | pre-fix | post-fix | old LineLoop |
|---|---|---|---|---|
| lab gentle drift (pitch .35, .12°/f) | toggles/frame | 162.6 | **158.5** | 162.6 |
| same | painted px | 5211 | 3779 | 2718 |
| lab grazing (pitch .002, .05°/f) | toggles/frame | 386.5 | 322.0 | 214.6 |
| same | painted px (smear incl.) | 2261 | 1749 | 1815 |
| **prod close-Jupiter, still cam + autoRotate** | toggles/frame | **322.7** | **202.8** | n/a (vanished) |

- perRingLadder (7 distances × 13 rings × both modes): **zero cells** where
  LineLoop is visible and SDF is not; SDF coverage ~2× LineLoop at every distance
  (anti-vanish property intact).
- Suite: 491/491 at 140859f.

## Screenshots

- `staticky-prefix-close-jupiter.png` — fat bright seething band through the view.
- `staticky-postfix-close-jupiter.png` — crisp thin ring line; near segment
  correctly in front of the planet disc, far moon ring occluded behind it.

## For re-UAT (Max)

Feel is the gate. Taste knobs live on every ring material:
`uPixelWidth` (band width, px), `uFeatherPx` (0.25 crisp … 1.0 soft, shipped 0.5).
Remaining honest limitation: at violent grazing motion the thin line still pops
pixels at ~1.5× the old LineLoop's rate (322 vs 215 in the lab's worst case) —
that is the irreducible cost of the line *existing* at ranges where the LineLoop
simply vanished. If it still reads staticky, next escalation is width 1.5–2.0
(chunkier line, lower relative shimmer), not more alpha shaping.
