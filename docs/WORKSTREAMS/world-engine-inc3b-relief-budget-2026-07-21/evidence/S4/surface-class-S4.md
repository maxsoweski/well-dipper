# surface-class-S4 — relief-structure read (target-seed1 vs committed LOLA hillshade)

**Slice:** S4 re-gate (post S1 relief-budget flip + S3-fix in-shader synth crater-texture channel).
**Frozen rule:** `calibration/read-gate-thresholds.json .surfaceClass` — verdict read off **RELIEF STRUCTURE
(crater density + texture), NOT albedo**; `densityTextureClause`: "same surface class: heavily cratered"
requires a **matching density/texture read**, not merely "a lumpy sphere."
**Reference:** committed `evidence/S2/reference-lola-hillshade.png` (LRO/LOLA shaded-relief DEM, already pushed
through the SAME posterize/dither/pixelScale pipeline; **reused, not re-fetched** per acquisition rule).
**Stimulus:** `evidence/S4/crops/target-seed1.crop.png` — disc-only crop, GUI excluded by geometry
(S2-contamination lesson honored; no blind agent / GUI in frame).

Both are relief-only (pre-albedo render vs DEM hillshade) → identical information content, so the albedo
confound is eliminated by construction. The palette difference (target reddish-tinted vs reference gray) is
**albedo/colour and is explicitly NOT read** per the rule; only structure is compared.

## Quantitative structure comparison (lit pixels only; local detail = mean |lum − 3×3 mean|)

| Metric | LOLA reference | target-seed1 (disc, lit) | reading |
|---|---|---|---|
| local-detail mean (/255) | **5.90** | **2.47** | reference carries ~**2.4×** the high-frequency structural density |
| local-detail std | 8.89 | 3.60 | reference structure is both denser and higher-variance |
| lum std | 26.74 | 21.16 | target somewhat flatter globally |
| dynamic range (p90−p10) | 51 | 56 | **comparable** — target is NOT washed out; shadow depth is there |

## Visual read (adversarial)

**LOLA reference:** wall-to-wall cratering at **every** scale — large basins, medium bowls, dense small-crater
overprint — **uniform** high density across the entire frame. This is the canonical "heavily cratered" texture.

**target-seed1:** unambiguously a cratered impact body — discrete bowl craters with correct light-consistent
arc shadows are clearly resolved, concentrated in the **terminator/limb zone** (left flank, lower disc) where
oblique light reveals the bowls. The **sun-facing central expanse** reads comparatively **relief-smooth**: it
carries the fine synth sub-floor stipple (see `s4-arc-report.json.newChannelObservables` — the channel repaints
~12.7% of that expanse) but the **discrete-crater density there is visibly below the reference's wall-to-wall
cratering**. This is not "merely a lumpy sphere" — real, resolved, light-consistent craters are present — but
the density/texture does **not** match the LOLA reference across the whole disc.

## VERDICT: **SAME BROAD CLASS (cratered impact body), but density/texture UNDER-MATCHES the reference**

- **Class agreement (qualitative): YES.** The target is a heavily-cratered impact-relief body with resolved
  bowls and correct oblique-light shadowing — categorically the LOLA hillshade's class, not an icy/tectonic/
  fluvial distractor.
- **densityTextureClause (the strict bar): PARTIAL / NOT FULLY MET.** The reference is ~2.4× denser in local
  structure; the target's crater texture is **spatially uneven** — reference-grade at the terminator, but the
  sun-facing expanse stays relief-smoother than the uniformly-cratered reference even after the S3 synth fix.

**Honesty note (consistent with the rest of S4):** this under-match is the SAME shortfall the frozen arc bar
convicts (FAIL on all three renders) and S3 diagnosed — the ≥-median crater **walls are sub-mesh** at this
display scale; the S3-fix synth channel restores a **subtle** sub-floor stipple (present by coverage, modest by
amplitude) but does **not** lift the disc to LOLA-grade crater-texture density. Recorded as it falls: the render
is legibly, correctly cratered (gestalt class holds), and it is **not yet a density/texture match** to the
relief-dominated reference. No re-tuning; verdict stands whichever way it fell.
