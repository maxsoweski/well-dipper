# AC-LAB-READ — live paired-same-seed evidence (Inc-3 relief envelope A/B)

**Workstream:** world-engine-inc3-relief-spine-depthlaw-2026-07-21
**Branch / HEAD:** feature/world-engine-production-L1 @ 1bae82b
**Driven:** 2026-07-21, working-Claude over CDP (puppeteer-core 25.3.0 → live debug
Chrome/150 at :9223), lab served at `http://localhost:5174/well-dipper/planet-lod-lab.html`.
**AC:** at the UAT failing point (Moon/Mercury preset, LOW drawn R+g), paired
same-worldSeed before/after showing discrete crater bowls / legible rim arcs vs the
wavey-magma read, quantified via a stated metric, zero new console errors.

---

## 1. Server-identity check (post-build L1 tree)

`GET http://localhost:5174/well-dipper/planet-lod-lab-core.js` contains
`reliefEnvelope` → **PASS** (the server serves the post-build L1 tree with the new
envelope law, not a stale pre-Inc-3 core). The driver was only run after this passed.

## 2. Live state at the failing point (read from the page)

| field | value |
|---|---|
| preset | `Moon/Mercury (impact-airless)` (the v2-5 impact-airless preset) |
| worldSeed | **1** (lab boot default; radiusSeed/macroSeed/detailSeed = 1 pre-reroll) |
| radiusEarth `_RE` | **0.38** (Mercury-class small body) |
| surfaceGravity `_gNow` | **0.27701** g⊕ |
| `state.perturb` (base) | 0.55 |
| `uPerturb` (live uniform) | 1.15802 |
| **live envelope multiplier** `uPerturb/perturb` | **2.10549** |
| camera | distance 2.6 radii (disc fills frame), spin frozen (spinSpeed 0), yaw 0.337, pitch 0.205 |

The live envelope multiplier **2.105 at g = 0.277 reproduces the BUILD-NOTES popsweep
boot record exactly** ("Moon/Mercury boot: reliefMult = 2.105 at g = 0.277"). This is
the LOW-R/LOW-g airless failing regime the UAT flagged.

> **Deviation flagged loudly (drawn radius):** the lab's default-seed boot draws
> **R = 0.38** (the Mercury end of Moon/Mercury), not the math-check's worked point
> R = 0.27 (the Moon end). At R = 0.38 the retired law evaluates to **5.0×**, not 7.0×
> (the 7.0× belongs to R = 0.27). The envelope multiplier (2.105) is radius-independent
> so it is identical either way. Both R ends are the same low-g airless failing family;
> this evidence is the Mercury-radius draw.

## 3. The paired multipliers (A = new law, B = old-law emulation, SAME worldSeed)

Old law (retired `reliefNorm`) = `(1/RE)·clamp(g^-0.5, 0.4, 2.5)`; new law
(`reliefEnvelope`) = `clamp(g^-0.58, 0.40, 133)` with an internal `max(g,1e-3)` floor.

| quantity | value |
|---|---|
| `reliefGravityFactor` = clamp(0.277^-0.5,0.4,2.5) | 1.900 |
| **old law** (1/0.38)·1.900 | **5.000×** |
| **new envelope** (live) | **2.105×** |
| **ratio** old/new | **2.3747×** |
| `state.perturb` for B | 0.55 · 2.3747 = **1.30611** |
| B `uPerturb` produced (= 0.55·5.000) | **2.750** (the exact old total multiplier) |

**Emulation method:** the frame loop computes `uPerturb = state.perturb ·
reliefEnvelope(_RE,_gNow)` every frame, so multiplying `state.perturb` by
`oldLaw/envelope` makes `uPerturb = perturb·oldLaw` — the exact retired total
multiplier, at the identical worldSeed (only `state.perturb` was touched; R, g, seeds,
camera, light all held). **`state.perturb` was RESTORED to 0.55 afterwards and confirmed
(`state.perturb === 0.55`, ok:true).**

## 4. Screenshots (committed here)

| file | law | view |
|---|---|---|
| `AC-LAB-READ_A_newlaw_full.png` | new envelope (2.105×) | full disc, distance 2.6 |
| `AC-LAB-READ_A_newlaw_crop.png` | new envelope | close surface, distance 1.7 |
| `AC-LAB-READ_B_oldlaw_full.png` | old-law emulation (5.0×) | full disc, distance 2.6 |
| `AC-LAB-READ_B_oldlaw_crop.png` | old-law emulation | close surface, distance 1.7 |

All four at the SAME worldSeed / camera / light / frozen orientation; A↔B differ only in
the `state.perturb` multiply. Lab GUI panels were `display:none`-hidden for the capture
(canvas unaffected; disc unoccluded).

## 5. Metric (method stated plainly)

Computed on the two **full-disc** PNGs. Disc interior = geometric mask, centre of frame,
pixel radius from camera geometry (`pixR = (H/2)·tan(asin(1/2.6))/tan(25°) = 571.9 px`),
inner **0.90 R** (514.7 px) to exclude the silhouette limb. Luminance
`L = 0.299R+0.587G+0.114B`. 832,181 interior px per image.

- **darkClipFrac** — frac of interior px with L<12 (shadow blowout).
- **lumMean / lumStd** — first/second moment of L over interior (relief contrast).
- **meanSobel** — mean 3×3 Sobel |∇L| over LIT interior (L>22) — high-frequency edge energy.
- **distinctEdgeFrac** — frac of LIT interior with Sobel>60 — high-gradient-pixel density.
- **meanSobelLow** — Sobel on a box-blurred L (r=6) — low-frequency / broad-wave energy.
- **crispnessRatio** = meanSobel/meanSobelLow — high-freq vs broad-wave character (higher = crisper).
- **localContrast** — mean 5×5 std of L over LIT interior.
- **Shadow topology** (second harness) — threshold shadow L<20, 4-connected components
  (≥12 px); "merged wavey channels" vs "isolated crater floors".

### Numbers (A = new law, B = old-law emulation)

| metric | A (new, 2.105×) | B (old, 5.0×) | direction |
|---|---|---|---|
| darkClipFrac (shadow blowout) | **0.0575** | **0.0831** | B +44% shadow-clip |
| lumMean | 72.23 | 67.57 | B darker |
| lumStd | 28.43 | 30.11 | B higher contrast |
| localContrast (5×5 std) | 6.634 | 7.958 | B +20% |
| meanSobel (high-freq) | 34.345 | 40.795 | B +19% total edge energy |
| distinctEdgeFrac | 0.2111 | 0.2506 | B MORE high-gradient px |
| meanSobelLow (broad-wave) | 11.475 | 13.924 | B +21% |
| **crispnessRatio** | **2.993** | **2.930** | A +2% (≈ flat) |
| shadowFrac | 0.0659 | 0.0943 | B +43% shadow area |
| shadow nComponents (≥12px) | 37 | 172 | — |
| largest shadow comp (px) | 6213 | 9563 | B larger dominant channel |
| largestCompFracOfShadow | 0.1132 | 0.1219 | B |

## 6. Interpretation — reported whichever way it falls (per AC protocol)

**What the metric DOES show (clean, in the expected direction):** the old law (B) is
unambiguously the **over-driven / blown-out** read — **+44% shadow-clip**, darker mean,
higher luminance variance, **+20% local contrast**, +43% shadow area, and a larger
dominant shadow channel (9563 vs 6213 px). Visually the B crop is markedly harsher,
deeper-shadowed and more turbulent — the "magma, almost wavey" over-drive Max flagged.
A (new envelope) is the calmer surface. **The envelope collapse (5.0× → 2.105×, a 2.375×
reduction) removes real, measurable over-drive.** In the full-disc pair the discrete
circular crater cluster (right-of-centre) is more legible in A because the surrounding
terrain is calmer, while in B it is partly swamped by the harsher wavey shadowing.

**What the metric does NOT show — stated loudly (contradicts the naive expectation):**
the AC's expected signature was "**A** shows higher distinct-edge structure while **B**
shows broad low-frequency blowout." That is **only half borne out.** Because the envelope
is a **pure amplitude multiplier**, turning it up (B) raises **every** edge/contrast
metric — B has MORE meanSobel, MORE distinctEdgeFrac, MORE local contrast, not fewer. It
does **not** invert spatial-frequency character: **crispnessRatio is essentially flat
(A 2.99 vs B 2.93, +2%).** And at the close crop **both** the new and old law read as
wavey/blobby base-carrier relief — A is a softened version, not a categorically
"discrete crater bowls" texture. **So this envelope-only A/B quantifies an
AMPLITUDE / contrast / shadow-blowout collapse (the wavey-magma over-drive removed), NOT
a frequency-character flip to discrete craters.** The raw edge/component counts measure
over-drive magnitude, not rim discreteness; the only character-isolating metric
(crispnessRatio) is flat.

**Why:** crater *discreteness proper* (the d/D bowl-shape / rim-arc geometry) is the S2
**depth-law** fix, not the envelope. It is amplitude-independent, so an envelope-only
A/B cannot demonstrate it (see §7). The envelope's job — the one this A/B closes — is to
remove the over-drive magnitude that saturated normals into the molten read; that is
shown.

## 7. Depth-law before/after — alternate-method disclosure

The rendered B emulates **only the envelope factor**. The old **depth law**
(δ^-0.5 inversion → near-hemispherical pits, math-check cause #2) **cannot be rendered
without serving old code**, so it is NOT in these PNGs. The depth-law before/after is
closed by the committed **fence harness** instead — the AC-ADVECT-REGRESS alternate-method
precedent (atmo campaign): at a fixed worldSeed the crater **population is byte-identical
pre/post** (147 stamps, coverage 0.428556, all 147 `{centre,D_km,tI}` tuples + the
3154-node footprint) and only the **profile amplitudes** change, **strictly
shallower-or-equal** (exemplar[0] 0.01697 → 0.00041, every `|new| ≤ |old|`) —
`calibration/fence-population-invariance.mjs` + `calibration/fence-baseline.json`,
gated in `tests/worldengine-inc3-depth-law` (green).

## 8. Console verdict

Whole-session capture (console + pageerror + requestfailed listeners attached before
navigation): `[vite] connecting…` / `[vite] connected.` (debug) and **one 404**
(`Failed to load resource: 404`). Confirmed the 404 is the **known pre-existing
`favicon.ico`** (`curl http://localhost:5174/well-dipper/favicon.ico` → 404; the lab HTML
itself → 200). **Zero pageerrors, zero requestfailed, zero NEW errors.** → **PASS.**

## 9. Reproduce

- Driver: `scratchpad/ac-lab-read-drive.cjs` (CDP, ONE page, closed in finally,
  disconnect-only, GUI hidden, perturb restored).
- Metrics: `scratchpad/ac-lab-read-metric.cjs`, `scratchpad/ac-lab-read-shadows.cjs`
  (pngjs from the repo `node_modules`).
- Raw outputs: `scratchpad/ac-lab-read-state.json`, `-metric.json`, `-shadows.json`,
  `-console.json`.

## 10. Bottom line for the coordinator

- **Metric shift: YES** — the envelope collapse (2.375×) produces a clear, quantified
  reduction in shadow-blowout / contrast / total relief energy; B is demonstrably the
  over-driven wavey-magma read, A the calmer surface. Evidence committed.
- **"Visually discrete craters": PARTIAL / flagged** — discrete craters are more legible
  in A at full disc, but the close surface still reads wavey in both, and the aggregate
  metric is amplitude-dominated (crispnessRatio flat). The envelope-only A/B **cannot**
  prove a categorical discrete-crater flip; that is the depth law (§7, fence-closed).
- **AC-UAT (Max's holistic gate) remains the real arbiter** of "reads as heavily-cratered
  small world." This integration evidence supports the fix direction and the over-drive
  removal; it does not, on its own, settle the discreteness read.
