# Math check — v2-6 UAT low-g/low-R wavey-magma read (2026-07-21, wf_dc144889-350)

> Decision artifact for Increment 3 + depth-law rider. Max verbatim finding + full diagnostic below.

Diagnostic brief — "wavey magma" at low R + low g. Plain text, our-math (given pipeline) vs real bodies (planetary-science literature). Worked point: R=0.27 R⊕, g=0.28, Moon/Mercury preset.

================================================================
(1) SCALE-BY-SCALE COMPARISON — ours vs reality at small R
================================================================

metric | reality (small airless body) | ours @ R=0.27,g=0.28 | verdict
---|---|---|---
Rendered crater COUNT | texture spans 4-6+ size decades; small craters dominate the visible peppering (cum SFD slope -2 = equal area per size decade) | 147 stamped; 99.986% of the drawn ~1.08M pop is sub-node, folded into a regolithRoughness SCALAR that is NOT rendered | WRONG — no cascade, texture void between big features
Largest crater / R | 0.6-1.9 (Herschel/Mimas 0.70, Caloris/Mercury 0.64, SPA/Moon 1.44, Rheasilvia/Vesta 1.9) | drawn max ~0.56 R (dia ~0.28 of planet dia) | RIGHT
km-space SFD slope | cum N(>D) ∝ D^-2, diff ∝ D^-3 | B_SFD=2.0 (cum -2) | RIGHT (law) — but only 147 of it is realized in the render
Depth/diameter, FRESH SIMPLE | ~0.2 CONSTANT across small sizes (Pike 1977); complex/large craters DECREASE to 0.05-0.1 (Herschel 0.072, SPA 0.008) | d/D = 0.2546·δ^-0.5 → 0.36 at δ_ref, ~1.09 at the mesh floor where MOST of the 147 sit | WRONG — 2× too deep at ref, trend INVERTED and unbounded at small end
Relief / radius, as RENDERED | 0.003 Earth, 0.004 Mercury, 0.012 Moon, ~0.05 Mimas, ~0.15 Vesta, ~0.40 Phobos | apparent normal-perturb ≈ 0.70 R-equiv | WRONG — ~1.75× beyond the MOST extreme real body (Phobos), ~50× a Moon-sized body
Fine-texture floor | small-crater peppering is the DOMINANT visible cue | regolithRoughness=0.247 computed, awaiting Increment-8 consumer, invisible | WRONG — the main texture cue is absent
Rim signature | crisp raised rim ~0.04D throwing a shadow/highlight arc under oblique light | rim=0.20A but sits on over-deep bowls × 7× exaggeration → saturates into continuous relief | WRONG — rims blur into waves instead of discrete arcs
Relief-vs-gravity SIGN | low g → higher relief/R (strength-limited h_max/R ∝ 1/R²) | reliefGravityFactor = g^-0.5 | RIGHT (sign); magnitude/cap wrong

================================================================
(2) RANKED ROOT CAUSES of the "wavey magma" read
================================================================

#1  GLOBAL RELIEF OVER-EXAGGERATION — reliefNorm = (1/RE)·clamp(g^-0.5, 0.4, 2.5).
    CONFIRMED-BY-MATH. Convicting number: at R=0.27,g=0.28 → 3.70 × 1.89 = **7.0×** (uPerturb 0.55→3.85). The 1/RE term is UNCAPPED; it is the larger factor and it blows up as R shrinks.
    Why this is THE cause of the specific finding: the finding resolves when Max turns g/R UP. Turning g/R up does NOT add craters — nStamp is scale-free (~147 at every R). The ONLY thing g/R move is reliefNorm (1/RE·g^-0.5). So "craters resolve when I turn it up" = "the 147 bowls stop being vertically over-driven and read as craters again." That is a direct fingerprint of the reliefNorm multiplier, nothing else.

#2  CRATER-DEPTH LAW OVER-DEEPENS AND INVERTS d/D — craterAmplitude = CRATER_DEPTH_N·(δ/D_REF_RAD)^DEPTH_POW, CRATER_DEPTH_N=0.18, DEPTH_POW=0.5.
    CONFIRMED-BY-MATH. d/D = A/δ = 0.2546·δ^-0.5 → **0.36 at the reference crater (2× the fresh-simple 0.2), ~1.09 at the mesh floor** (near-hemispherical pits). Because the SFD is bottom-heavy, MOST of the 147 stamped craters sit near that floor — so the most numerous craters are the steepest, the exact inverse of reality (real simple craters hold d/D≈0.2; complex ones get shallower with size). A field of overlapping d/D~1 pits, further multiplied by #1, is what merges into "molten waves." R/g-INDEPENDENT — it is why even the big craters look melted, and why #1 tips it over rather than causing it alone.

#3  NO FINE-TEXTURE CASCADE — P_STAMP = 1.36e-4, MESH_FLOOR_RAD = 0.055 rad, sub-floor mass → regolithRoughness scalar (unrendered until Increment 8).
    CONFIRMED-BY-MATH. Only craters bigger than ~95 km (3.15° angular) render on a 1720 km world; everything below — i.e. the decades that carry the majority of real visible texture — is invisible. Result: smooth terrain between the few big bowls, which reads as undulating magma rather than a peppered surface.

#4  ICE RELAXATION on the Frozen preset plausibly compounds the smoothing (softens rims, deepens the molten read).
    SPECULATIVE — I did not trace the ice-relaxation numbers; flagging as a likely compounding factor on that preset only.

================================================================
(3) PHYSICS-CORRECT FIXES + audit mapping
================================================================

Cause #1 → **Increment 3 (relief-scale spine / RELIEF_NORM at the bake seam).** Bound the multiplier so total apparent relief/radius lands in the real small-body band (~0.05 Mimas … 0.15 Vesta … 0.40 Phobos max), NOT 0.70. Concretely: cap the uncapped 1/RE term (it currently runs to 3.7-10× at small R) so reliefNorm's product stays within a physical envelope — e.g. clamp reliefNorm to roughly [~0.5, ~3] and/or re-derive the small-R branch from h_max/R with a strength cap. Keep the g^-0.5 SIGN (correct); it's the magnitude and the uncapped radius term that are wrong. This alone should collapse the "magma" look because it stops over-driving the shading normals.

Cause #2 → **NEW scope, bombardment craterField channel (bombardment.js:craterAmplitude/craterProfile).** Change the depth law from d/D ∝ δ^-0.5 to **d/D ≈ 0.2 CONSTANT in the simple-crater regime** (A ≈ 0.2·δ, i.e. DEPTH_POW→~1.0 with CRATER_DEPTH_N retuned so fresh simple = 0.2), then a complex-crater ROLLOFF above the simple→complex transition diameter (which itself scales ~1/g — larger transition on low-g bodies, so most craters here stay simple bowls). This removes the near-hemispherical small pits and gives crisp, correctly-shallow rims. Not covered by Increment 3.

Cause #3 → **Increment 8 (regolithRoughness consumer)** for the sub-node cascade, PLUS a lab-mesh-density lift so MESH_FLOOR_RAD stops truncating at 3°. Until small-crater texture renders (either as displaced/normal-mapped micro-craters or a roughness-driven texture), the surface will look under-populated between basins no matter what #1/#2 do.

Priority: #1 first (it's the one gated to the finding and it's already queued as Inc 3), #2 second (small, high-leverage, makes the existing 147 craters read correctly), #3 third (adds the missing texture layer).

================================================================
(4) WHERE OUR MATH IS RIGHT — and what cue is actually missing
================================================================

Be honest with Max: parts of this are correct and should NOT be "fixed" toward Earth-like smoothness.

- **Large relief/radius on a small low-g body is REAL.** Vesta carries ~15% relief/radius, Phobos ~40%, and both look deeply lumpy and non-spherical in real photos. The g^-0.5 gravity term has the correct sign (low g → more relief). Do not flatten the small-body silhouette — a small body SHOULD read high-relief. The defect is magnitude (0.70 vs a realistic 0.15-0.40) and the uncapped 1/RE term, not the existence of exaggeration.
- **The giant basin is realistic.** Our drawn max ~0.56 R (Herschel is 0.70, Caloris 0.64) is dead-on; the km-space SFD (slope -2, coverage ~40% = mature/saturated) is sound.

So a saturated small airless body genuinely shares a lot with our render — the missing pieces are two specific VISUAL CUES, not the overall scale:
  (a) **small-crater peppering** (the -2 cascade) — the single dominant texture cue, currently unrendered (cause #3);
  (b) **crisp, shallow, correctly-proportioned rims** at d/D≈0.2 throwing shadow/highlight arcs — currently drowned by over-deep bowls × 7× exaggeration (causes #1+#2).
Add those two and the SAME large relief reads as a heavily-cratered small world instead of magma.

Max's hypothesis, adjusted: he's right that "the scales are off," but the axis is VERTICAL, not lateral. Lateral landform sizes (crater diameters, largest-basin fraction) are physically correct. The error is over-exaggerated vertical relief plus a missing fine-crater texture layer. The world isn't "too small-looking" — small bodies genuinely look small and lumpy; it's "too molten-looking," and that is a texture+d/D problem, not a landform-size problem.

Key files: bombardment.js (craterAmplitude/craterProfile/craterSchedule — causes #2,#3), world-engine-lab.html:5608 + planet-lod-lab-core.js:973/984 (reliefNorm — cause #1), surfaceMaterial.js:129 (regolithRoughness — cause #3 consumer for Inc 8).
