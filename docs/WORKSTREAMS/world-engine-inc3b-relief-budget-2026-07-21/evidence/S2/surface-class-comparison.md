# S2 surfaceClass read — LOLA hillshade reference vs render (seed 1)

Read-gate: `read-gate-thresholds.json .surfaceClass`. Bar reads **RELIEF STRUCTURE ONLY**
(crater density per disc area, size-frequency visual spread, rim/bowl texture) —
NOT albedo patches. `densityTextureClause`: verdict "same surface class: heavily
cratered" requires a **matching density/texture read**, not merely "a lumpy sphere."
A sparse dimpled sphere vs a saturated highlands field is a FAIL.

## Reference acquired (PRIMARY — no fallback needed)

- **Dataset:** LRO/LOLA gridded lunar DEM, product **LDEM_16** (16 px/deg, 5760×2880,
  LSB int16, HEIGHT = DN·0.5 m rel. 1737.4 km sphere).
- **Source (live, verified 200 OK, 33,177,600 bytes = 5760·2880·2):**
  `https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/cylindrical/img/ldem_16.img`
  (NASA PDS Geosciences Node, `lro-l-lola-3-rdr-v1` / `lola_gdr` / cylindrical). Label
  `ldem_16.lbl` from the same dir confirmed the raster spec. `ldem_4.img` (7.6 km/px)
  also fetched as a coarse cross-check; LDEM_16 (1.9 km/px) used because it resolves the
  highlands crater texture the coarse product blurs out.
- **Hillshade:** standard Lambertian (GDAL Horn 3×3), z-factor 1 (true scale), sun
  **az 40.6°, el 20.79°** — matched EXACTLY to `lightStaging` (the whole reason a DEM
  hillshade is the right pick: sun geometry is a free parameter, so no lighting confound).
- **Crop:** farside southern **highlands**, lat [−58°,−5°] × lon [130°,200°] — saturated
  impact terrain, no maria. (`reference-hillshade-prepipeline.png`, 1120×848.)
- **Pipeline (matched to render):** downsample ×3 to disc-comparable effective scale
  (render disc ≈742 px, pixelScale 3 ⇒ ≈247 effective px across) → **posterize 6 levels**
  → nearest-upscale ×3 for chunky-pixel parity. (`reference-lola-hillshade.png`.)
- Render pipeline params read from `target-seed1.state.json`: posterizeLevels 6,
  pixelScale 3, disc discFracHeight 0.70.

Builder: `reference-hillshade.mjs`. Side-by-side: `surface-class-sidebyside.png`
(left = render disc `render-disc-crop.png`, right = pipelined LOLA highlands).

## Side-by-side observations (relief only; render's pink is pre-albedo dither — IGNORED)

| Axis | Render (seed 1) | LOLA highlands reference |
|---|---|---|
| **Crater morphology / rim-bowl texture** | Correct impact morphology: bright sun-facing rims, dark shadowed bowls, flat-floored larger craters, overlapping rims in pockets. | Same morphology; textbook highlands rims/bowls. **Strong match.** |
| **Size-frequency spread** | Full continuum — a few large basin-scale craters (lower-left), many medium, abundant small pits. | Same continuum, large-to-resolution-limit. **Match.** |
| **Local saturation** | Lower-left quadrant + left terminator band are **saturated / overlapping** — highlands-like. | Uniformly saturated everywhere. Render matches *in its dense pockets*. |
| **Full-disc mean density / uniformity** | **Non-uniform.** Dense pockets, but the sun-facing central/right lit expanse reads relief-smooth. Full-disc mean density sits at the *lower edge* of highlands saturation. | **Uniform near-saturation**, essentially zero smooth area. **Partial match — the gap.** |

**Confound noted (honest, not an excuse-away):** the reference is a *flat* hillshade at
uniform oblique light; the render is a *lit sphere*. Craters near the render's sub-solar
(right-center) sit at low local incidence where shadows shorten and wash out, so part of
the central smoothness is sphere-lighting geometry, not true crater absence — the
terminator-lit zones (where the comparison is fair) do approach highlands saturation.
But part of the central sparseness is genuinely fewer placed craters: real gibbous
cratered moons still show craters across the lit face away from the exact sub-solar point,
and the render's central relief is quieter than that. So the density gap is **real but
partially lighting-inflated.**

## Verdict

**SAME SURFACE CLASS: heavily cratered — PASS (qualified).**

The render is unambiguously an **impact-cratered body of the lunar-highlands family**,
not "a lumpy sphere" and not "a sparse dimpled sphere": it carries genuine overlapping
crater saturation in its dense regions, correct rim/bowl morphology, and a full
large-to-small size-frequency spread — the three things the bar reads on. On **texture**
and **size-frequency** it matches the LOLA reference well.

The one honest reservation is **density uniformity**: the render's *full-disc mean* crater
density is non-uniform and at the lower edge of the reference's uniform saturation, with
the smooth sun-facing center partly (not wholly) a sphere-lighting confound. This keeps it
a *qualified* pass rather than a slam-dunk uniform-saturation match — but it does not drop
the render into a different surface class (it is decidedly cratered-impact terrain, not
ridged/fluvial/icy-chaos). Under `densityTextureClause` the matching texture + size-freq +
locally-saturated density read clears the "not merely a lumpy sphere" bar.

Confidence: HIGH that it is the same *surface class* (heavily cratered impact body);
LOW that it is a *uniform-saturation* pixel-density match to peak highlands.
