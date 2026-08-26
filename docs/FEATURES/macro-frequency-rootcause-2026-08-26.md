# Terrain frequency — root cause, 2026-08-26

**Max's question, verbatim:** *"that frequency might be right up close, and the issue might be that
our LOD system isn't working with it properly. Or: rather than making the curve move to the
renderable range, should we widen the renderable range to include the curve?"*

**The answer the measurement gives: the curve is fine and the LOD half is broken — but not in the
way either hypothesis guessed.** It is not the octave ramp saturating at 6 radii. It is that the
octave stack has **no legibility floor at all**, only an anti-aliasing one, set at half the bar the
rest of the engine uses.

Reproduce everything here with `node tools/macro-screen-floor-probe.mjs`.

---

## 1. ⭐ THE FINDING — the engine carries TWO screen-resolvability rules and they disagree

| | rule | in render px per cycle | source |
|---|---|---|---|
| craters | must **read** as a feature | `>= 4.00` | `src/worldengine/port/craterUniforms.js:65-71` |
| noise stack | must not **shimmer** | full weight to `2.50`, zero at `1.25` | `src/worldengine/shaders/heightNoise.glsl.js:95-98` |

The crater rule states its reasoning: *">= 4 RENDER px ... 2x Nyquist, because a crater has to show
bowl AND rim to read as one, not merely be detected."* The noise stack's fade states a different
purpose in its own comment — *"kills dither shimmer"* — and is set at Nyquist.

⭐⭐ **`2.50 .. 4.00 px/cycle` is therefore an ungated band: an octave landing there is kept at
essentially FULL weight while sitting below the repo's own legibility bar.** Nothing anywhere in
the engine removes it. That band is where the speckle lives.

⚠ **And the gradient is what the eye reads, not the height.** `fbmd` accumulates
`grad += amp * w * freq * n.yzw` with `amp` halving and `freq` doubling, so `amp*freq` is CONSTANT
across octaves: **every surviving octave contributes equally to the surface normal**, however small
its height weight. A 1/256-amplitude octave shades as hard as octave 0.

## 2. WHERE THE LAW'S RANGE ACTUALLY LANDS (game framing, 1.2 radii, disc 359.41 render px)

| uNoiseScale | oct0 | oct1 | oct2 | octaves alive | % of the NORMAL under the 4px bar |
|---|---|---|---|---|---|
| 2.8736 — base law, min & p50 | 416.9 px | 208.5 px | 104.2 px | 9 | **17 %** |
| 245.175 — corpus max | **4.89 px** | **2.44 px** w=1.00 | 1.22 px w=0 | 2 | **50 %** |
| 251.031 — `MACRO_FREQ_CEIL` | 4.77 px | 2.39 px w=0.99 | 1.19 px w=0 | 2 | **50 %** |

⭐ **The law's ceiling is NOT the problem: octave 0 lands at 4.77–4.89 px and clears the 4 px bar.**
`macroWavelength.js` §4 checked exactly this and was right. What it did not check is that the
*next* octave lands at 2.39 px, survives at 99 % weight, and carries half the surface normal.

⛔ **The law validated itself against the wrong octave stack.** §4 reasons about *"the base stack's
2x and 4x octaves (0.3 of its 1.15 total weight)"* — those weights are `computeHeight`'s 4-tap
(`height.glsl.js:690`, taps at 0.3/1/2/4). The path that renders is `fbmd`: **9 octaves at 2x
spacing with equal gradient weight.** The sub-4px content is not 0.3 of 1.15 — it is half the normal.

## 3. LIVE SWEEP — Europa, arm B, framing driven through the lab's own `frameBody()`

| distance (radii) | disc px | octaves alive | under the 4px bar | finest kept | % of normal under the bar |
|---|---|---|---|---|---|
| 12 | 76 | 1 | 1 | 1.63 px | **100 %** |
| 8 | 114 | 1 | 1 | 2.45 px | **100 %** |
| 6 | 153 | 2 | 2 | 1.65 px | **100 %** |
| 4 | 234 | 2 | 1 | 2.51 px | 50 % |
| 3 | 320 | 3 | 2 | 1.72 px | 61 % |
| 2 | 522 | 4 | 2 | 1.41 px | 36 % |
| 1.3 | 1089 | 5 | 2 | 1.47 px | 29 % |

⭐ **The finest surviving octave is 1.4–2.5 px/cycle at EVERY distance.** The fade never removes it,
because the fade's threshold is 1.25 px and not 4 px.

⭐ **From 12 to 6 radii — the whole normal viewing range — 100 % of the surface normal comes from
octaves below the legibility bar.**

⛔ **This kills the ramp-saturation framing.** `uOctaves` is 7.03 at 12 radii and 8.72 at 8 radii,
pinned at 9.00 everywhere inside 6 radii — so the budget binds only at long range, and inside 6
radii the *fade* is the sole gate. Raising the ramp cannot help: the octaves it would add are
already past Nyquist. The 6-radii saturation recorded in `well-dipper-approach-lod-criterion` is
real but is not the cause of this.

## 4. ⭐ THE INSTRUMENT UNDERSTATES THE DEFECT — the lab is 3–7x kinder than the game

Two independent causes, both measured live:
1. the lab writes `physical * sVis` (`planet-lod-lab.html:5359`) and `sVis < 1` on small bodies;
2. the lab renders at full canvas resolution; the game divides by `pixelScale` 3.

| preset | physical | lab written | lab oct-0 | game oct-0 | lab is kinder by |
|---|---|---|---|---|---|
| Lava | 250.7 | 141.6 | 32.12 px | **4.78 px** | 6.7x |
| Europa | 219.0 | 154.9 | 29.37 px | **5.47 px** | 5.4x |
| Magma | 251.0 | 307.4 | 14.79 px | **4.77 px** | 3.1x |

**Max is judging this on the mild arm.** Whatever he sees in the lab, the game is 3–7x worse on
exactly the hot bodies where the problem lives.

⚠ Magma's lab value (307.4) exceeds `MACRO_FREQ_CEIL` (251.03) because `sVis` is 1.22 on a 1.5 R⊕
body. That is the lab's declared display policy, not a defect — but it means **lab readings are not
comparable to the law's ceiling.**

## 5. THE CEILING THE 4px RULE WOULD IMPLY (game framing) — ⛔ NOT A RECOMMENDATION

| if the finest KEPT octave must clear 4 px with... | ceiling on uNoiseScale |
|---|---|
| octave 0 only (what §4 checked) | 299.51 |
| 2 octaves | 149.75 |
| 3 octaves | 74.88 |
| 4 octaves | 37.44 |

Against today's `MACRO_FREQ_CEIL = 251.031`. **Which row is right is a LOOK decision and is Max's** —
it is how many octaves the field is meant to show. Recorded so the number is derived from a stated
rule rather than picked by eye, which is what he asked for.

⚠ **The two halves are coupled and the fix order matters.** Raising the fade to the 4 px bar without
touching the law leaves hot bodies with only octave 0 — smoother, not better. Lowering the law's
ceiling without raising the fade leaves the ungated band in place for every other body (it is
already 17 % of the normal on a cold one).

---

## 6. ⛔ HYPOTHESES KILLED — do not re-derive these

1. ⛔⛔ **`RELIEF_DOMAIN_SCALE` does NOT double-count `C_MACRO`.** `C_MACRO = 1/0.3` and
   `RELIEF_DOMAIN_SCALE = 1.0/0.3` (`src/objects/Planet.js:1381`) look like they cancel, which would
   make the game render 3.333x finer than the law intends. **They never meet.** `RELIEF_DOMAIN_SCALE`
   is on the LEGACY material (`:1682`), which writes the drawn `d.noiseScale`.
   `Planet._createLabSurface` (`:2031`) builds from `buildLabPlanetMaterial` — the LAB's factory —
   so an admitted body carries `uDispDomainScale = 1.0` (`uniforms.js:17`).
   **CONFIRMED LIVE 2026-08-26: `uDispDomainScale` 1, `uNormalMode` 0, `uFwClamp` 1.** The law is
   honoured exactly on the rendering path.
2. ⛔ **The octave ramp is not the binding constraint inside 6 radii** — see §3.

## 7. ⚠ TRAPS HIT WHILE MEASURING

1. ⛔ **Writing `camera.position` does NOT drive the lab's render.** The frame loop rebuilds the
   camera from `state.distance`; `frameBody({radii})` is the only supported way to change framing.
   A first sweep wrote `camera.position` directly, produced a full table of plausible numbers, and
   **the two screenshots at 8 and 1.4 radii came back pixel-identical** — the probe never reached
   its subject. Verify a framing change by the disc's size on screen before believing any row.
2. ⚠ **Magma is confounded and is the wrong body for a visual check** — its surface is the legacy
   F41 magma-ocean placeholder ("placeholder dressing ON", slated for replacement), not the base
   field. At 1.3 radii it renders perfectly smooth regardless of the wavelength law.
3. ⚠ `setPreset('lava')` (lower case) silently draws a COLD body — `_abNoiseScaleGame` 2.87 rather
   than 250.7. Use the GUI's exact names, e.g. `'Lava (hot airless)'`.
