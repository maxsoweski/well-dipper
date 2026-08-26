# Rings, measured — the resolvability ruling applied to the ring that the game actually draws

**Date** 2026-08-26 · **Probe** `tools/ring-resolvability-probe.mjs` (`node tools/ring-resolvability-probe.mjs`)
**Corpus** 60 generated systems → 33 ringed planets · **Nothing built. This is the measurement only.**

> ⛔ This exists because the previous session's whole lesson was *measure before building*: three
> fixes shipped that session were locally correct and globally wrong because they sat downstream of
> a model nobody had measured. `docs/FEATURES/lod-architecture-rootcause-2026-08-26.md` is that record.

---

## 0. ⛔ THE SCOPE DOC NAMED THREE FILES AND ALL THREE ARE THE WRONG FILE

`docs/FEATURES/resolvability-scope-2026-08-26.md` lists rings as
`RingRenderer.js` / `ringConic.js` / `OrbitRingSDF.js`. Verified here:

| file it named | what it actually is |
|---|---|
| `src/rendering/objects/RingRenderer.js` | **DEAD.** Instantiated nowhere in `src/` — `grep -rn RingRenderer src/` returns only its own definition. Independently recorded in `FEATURE_AUDIT_LEGACY §2.4` and `JOURNEY.md:48`. |
| `src/objects/ringConic.js` | **ORBIT** rings, not planetary rings. Already measures its band in RENDER PIXELS (`bandReachPx`, Sampson distance in px). |
| `src/objects/OrbitRingSDF.js` | **ORBIT** rings. Out of scope by the scope doc's own boundary — *"OUT: stars, orbit lines, HUD strokes."* |

⭐ **The live planetary ring is `src/objects/Planet.js` `_createRing()` (:1764–1893)**, added to the
planet mesh at `:1537`. Everything below measures that program.

---

## 1. WHAT THE LIVE SHADER EMITS, in frequency terms

```
t     = (dist - innerRadius) / (outerRadius - innerRadius)   // 0..1 across the annulus   :1851
band1 = sin(t * 30.0) * 0.5 + 0.5     ->  30/2π = 4.775 cycles across the WHOLE ring      :1853
band2 = sin(t * 12.0 + 1.0) * 0.5 + 0.5 -> 12/2π = 1.910 cycles                           :1854
```

A readable feature is one bright lobe = **half a cycle**, so px-per-feature = extent_px / (2·cycles).

⛔ **There is no `fwidth`, no derivative, no footprint and no mip anywhere in the program.** The only
screen-space term is the Bayer dither, and that is an alpha *stencil*, not a resolvability gate.

## 2. THE CORPUS

| | min | median | max |
|---|---|---|---|
| ring width (body radii) | 0.52 | **1.33** | 1.99 |
| inner radius (body radii) | 1.94 | 2.94 | 4.03 |
| outer radius (body radii) | 2.52 | 4.36 | 5.60 |
| radial extent / outer radius | 0.160 | **0.311** | 0.451 |
| `ringOpacity` | 0.200 | **0.201** | 0.781 |

## 3. ▶ THE FINDING — the bands fail the 4px bar over ~3/4 of the sky

Framing used is the **most generous the ruling allows**: the closest distance at which the whole ring
still reads AS a ring — its full diameter just filling the 333-render-px height (≈ 6.2 body radii for
the median body). Elevation is the camera's angle above the ring plane.

| elev | radial extent px | band1 px/feature | verdict |
|---:|---:|---:|---|
| 90° | 51.8 | 5.42 | PASS |
| 60° | 44.8 | 4.69 | PASS |
| **45°** | 36.6 | **3.83** | FAIL — bands blur |
| 30° | 25.9 | 2.71 | FAIL |
| 15° | 13.4 | 1.40 | FAIL |
| 10° | 9.0 | **0.94** | FAIL — SUB-PIXEL |
| 2° | 1.8 | 0.19 | FAIL — SUB-PIXEL |

**band1 crosses the 4px bar at elevation:** min **30.6°** · median **47.6°** · max 90.0° (some bodies
never pass at any elevation).

Taking camera directions as uniform over the sphere, the share below that elevation is `sin(elev)`:

> ⭐ **51% / 74% / 100% of viewing directions fail the bar** (min / median / worst body).

⚠ **That is the optimistic reading.** The player flies near the ecliptic, so LOW elevations are
over-represented relative to uniform — the true share is worse than 74%, not better. Stated as an
assumption, not measured.

### Face-on is the best case and it only passes in a narrow distance window

| distance (body radii) | ring diameter px | band1 px/feature | verdict |
|---:|---:|---:|---|
| 6 | 345 | 5.90 | overflows the screen |
| **8** | 259 | **4.42** | **PASS** |
| 12 | 173 | 2.95 | FAIL |
| 20 | 104 | 1.77 | FAIL |
| 40 | 52 | 0.88 | SUB-PIXEL |

⭐ **Face-on, the bar is met only between roughly 6 and 9 body radii.** Beyond ~12 radii the bands are
sub-4px even with the ring square-on to the camera — which is the orrery/system-map framing.

## 4. ▶ AND THE ALPHA TEST IS THE OTHER HALF

`Planet.js:1884` — `if (bayerDither(gl_FragCoord.xy) > alpha) discard;`

A 4×4 ordered dither has 16 thresholds, so coverage = the share of the cell whose threshold < alpha.
`alpha = density · (1 − gap·0.8) · ringOpacity · edgeFade · shadowFade`, and `density` averages ~0.5.

| ringOpacity | share of corpus | alpha at mean density | pixels drawn |
|---:|---:|---:|---:|
| **0.200 (the floor)** | **67%** | 0.100 | **2 / 16** |
| < 0.300 | 85% | ≤ 0.150 | ≤ 2 / 16 |
| 0.781 (max) | 3% | 0.390 | 6 / 16 |

⭐ **The floor is not a bug** — `PhysicsEngine.js:937` sets `density = 0.2 + 0.6·exp(−age/lifetime)`,
and most generated rings are old, so most rings are *meant* to be tenuous remnants. **Whether a
13%-coverage ring reads right is Max's eyes, and it is not claimed here as a defect.**

⛔ **What IS a defect is that the stencil is nailed to `gl_FragCoord`.** The ring rotates
(`Planet.js:1946`) and the camera moves, so the ring's surface slides through a stationary 4×4
stencil and each surface point pops on and off as it crosses pixels. Combined with §3 — a band
narrower than a pixel, sampled by a screen-locked stencil — there is **nothing in the program that
can average anything**. That is the scintillation mechanism, and it is worst exactly where §3 is
worst: low elevation, long range.

## 5. CONTROLS — measured, and NOT the defect

- **`RingGeometry(inner, outer, 64)` — the 64-gon.** Chord sagitta = 1.20e-3 × outer radius →
  0.83 px at 1.5 body radii, 0.16 px at 8. **Sub-pixel at every framing that shows a ring.** Not it.
- **Moon gaps** (`Planet.js:1900`, fired from `main.js:7805`). Fires on **4 of 33** ringed planets —
  only when a moon orbits inside the annulus. Width 0.154–0.399 body radii → 12 px at 90°, 6 px at
  30°, 2 px at 10°. A broad low-frequency feature that fails only where the whole ring already
  fails. **No separate remedy needed.**
- **The Cassini gap** (`:1860`): plateau is 5% of the annulus, smoothstep edges 3% each → 2.6 px /
  1.6 px at 90°, 0.45 px / 0.27 px at 10°. Below the bar at every elevation, but it is one feature
  rather than a repeating frequency, so it wants a *minimum size*, not a fade. Different remedy.

## 6. ⚠ SEPARATE STRUCTURAL FINDING — the ring physics is generated and thrown away

Not part of the ruling, recorded because it was found while tracing the pipeline and it changes what
any ring work is building on:

1. `PlanetGenerator.js:561` calls `generateRingPhysics({ ..., moons: [] })` — **moons are not
   generated yet at that point**, and the comment says so. Resonance gaps are derived from moons, so
   **0 of 33 generated rings have any gap, and every one is a single ringlet.** Measured.
2. `rings.physics` is consumed **nowhere in rendering** — `grep -rn "rings.physics" src/` outside
   tests returns nothing. Composition, ringlets, gaps and `ringAgeGyr` are computed and discarded.
   Only `density` (→ `opacity`) and `color1`/`color2` reach a shader.
3. So the game's ring is the **legacy `sin(t*30)` fallback path in every case** — the branch
   `RingRenderer.js` was written to replace, and the branch the world-engine lab does *not* render
   (`world-engine-lab.html:489` deliberately swaps in the dead physics path instead).

⛔ **Consequence for instrumentation: the lab cannot judge the game's ring.** The lab/game parity
that was made load-bearing for terrain does not extend to rings — the lab draws a different program.

## 7. WHAT THE MEASUREMENT IMPLIES ABOUT THE REMEDY

The scope doc already rules the shape: *a pure in-shader pattern needs the fbm-style screen fade*,
and this is a pure in-shader pattern. The terrain division of labour applies unchanged —
**distance budget binds FAR, fwidth fade binds NEAR** — but here both are the same axis (`t`), so
one screen-space gate covers it: fade band amplitude toward the band mean where
`fwidth(t) · cycles` says a lobe has fallen under 4 render px.

⭐ **The one genuine fork, and it is a taste call, not a technical one:** the gate makes an
edge-on ring resolve to a **smooth, evenly-lit annulus** rather than a flickering striped one. That
is correct by the ruling and it is what a real ring does at distance. It also means a ring seen
edge-on has no visible banding at all.

⛔ **NOT BUILT. NOT SCOPED.** Next step is `dev-collab-scope` → `intent.md` + `contract.json`.
