# Nebula reshaping guide — from 43 reference photos to the cloud field (2026-10-03)

Sources: four structural-study passes over `research/nebula-refs/*.jpg`, and the current renderer (`src/galactic/cloudFieldCPU.js`, `shaders/cloudField.glsl.js`, `renderPacks.js`, `featureHistory.js`). Every change below must land in **both** twins (CPU and GLSL) with the same arithmetic, and the parity fences will catch any drift. The estimates of what survives at about 360 rows were made by eye from the photos, not tested in a render.

Distance regimes: **patch** = a few to about 30 px across; **landmark** = fills 10–60% of the view; **inside** = camera within or against the cloud.

## 1. Why ours reads as a ring

Four terms combine into "a sphere with a smaller sphere scooped out, lit from the middle":

1. **`envelope(r)` / `cloudEnvelope(length(p))`** is a radial `smoothstep` on `|p| / radiusPc`. The outline is a perfect circle from every direction, with the same falloff on every side.
2. **The cavity term in `density()` / `cloudDensity()`** is `mix(1 - depth, 1, smoothstep(0.6·Rc, Rc, distance(pl, cavity.centrePc)))`. This is a spherical hole, depth 0.85, with radius up to about 0.55 R. It is centred on the ionizing offset (0.1–0.45 R) and almost never reaches the envelope edge, so the shell is **closed**. A closed thin-walled sphere projects as a limb-brightened ring.
3. **The ionization weight `x = 0.25 + 0.75·exp(-g²)`**, with `g = ds / glowRadiusPc` and `glowRadiusPc = max(1.6·Rc, 0.25 R)`, is radial about the **same point** as the cavity.
   - The brightest gas is the shell right around the hole, lit evenly all the way round.
   - The 0.25 floor makes neutral gas glow too, so there is no ionization front anywhere.
4. **Emission and extinction share one field:** `j ∝ rho·x` and `k ∝ rho`. Dense gas glows and absorbs in the same place, so nothing can read as a dark silhouette in front of glow.

Smaller contributors:
- The `[O III]` weight `w = hardness·exp(-ds/oiiiRadiusPc)` is radial about the same centre, which gives a concentric colour ring.
- `logStructure` is isotropic, so there is no direction or streaming.
- Emission is linear in `rho` rather than density squared, which spreads the bright regions out.
- When the random source direction from `unitVector` points near the line of sight, the result is a centred bullseye.

## 2. Structure catalogue

| # | Trait | Photos | How common | Reads at |
|---|---|---|---|---|
| T1 | Open or broken shell: one thick bright side, one thin or missing side | 1-heart-and-soul, 1-orion-region-head-to-toe (Barnard's Loop, about 200°), 1-rosette-noirlab, 8-rosette-true-colour, 4-rcw120-spitzer, 4-bubble-ngc7635, 7-veil-complex | Every shell object | patch, landmark |
| T2 | Off-centre brightness: about 70% of the light in about 25% of the area | 2-orion-m42-m43-noirlab, 2-orion-m42-vst, 1-lagoon-eso, 1-orion-nebula-dss2, 1-carina-eso, 8-lagoon-true-colour | Nearly universal | patch (strongest far cue), landmark |
| T3 | Blister or bowl: open on one side, dim interior, bright walls facing the source | 2-orion-m42-vst, 9-orion-hubble-mosaic-inside, 1-eagle-m16-kpno, 9-rho-ophiuchi-jwst-inside | All H II regions seen close up | landmark, inside |
| T4 | Foreground dust sets the outline: sharp wedges, banks and lanes | 1-north-america-pelican, 1-carina-eso, 1-lagoon-eso, 1-sadr-gamma-cygni, 2-orion-m42-m43-noirlab, 6-m78-eso | About 60% of emission images | all three |
| T5 | Bright rim on dense surfaces facing the stars; frayed shadow side | 3-horsehead-ic434-noirlab, 3-carina-landscape-hubble, 3-carina-mystic-mountain, 3-pillars-of-creation-hubble2014, 1-north-america-pelican, 7-veil-hubble-detail | Every close view; highest contrast | landmark, inside |
| T6 | Pillars, trunks and globules pointing at the source | 3-pillars-of-creation-*, 3-elephant-trunk-ic1396a, 1-eagle-m16-kpno, 8-rosette-true-colour, 3-carina-mystic-mountain | 3–4 per wall field | landmark, inside |
| T7 | Elongated or lobed silhouettes, with notches and a flat side | 1-california (about 10:1), 1-lagoon-eso (2:1), 7-crab-hubble (1.4:1), 7-simeis147, 8-rosette-true-colour | Every visible outline | patch, landmark |
| T8 | Directional filaments and streamers | 5-herschel-star-nursery, 5-taurus-cloud-*, 5-pipe-nebula, 5-rho-ophiuchi-complex, 1-orion-nebula-dss2 | Dominant in dark clouds | landmark |
| T9 | Layered translucency: veils over walls, dark in front, glow behind | 2-m43-hubble, 1-carina-eso, 4-bubble-ngc7635, 9-orion-hubble-mosaic-inside | Universal | landmark, inside |
| T10 | Inside views split into zones by a wavy ridge: lit cavity versus dark wall | 9-cosmic-cliffs-jwst-inside, 3-cosmic-cliffs-jwst-composite, 3-horsehead-euclid, 1-sadr-gamma-cygni | Every inside view | inside |
| T11 | Colour changes across the front, not by radius | 2-orion-m42-vst, 7-veil-complex, 3-carina-landscape-hubble (structure only) | Common | landmark |

Scale budget (all four study groups agree):
- Large-scale asymmetry carries most of the read.
- 3–8 medium features (up to about 20) carry the rest.
- Fine fibrils and swarms of small globules disappear at 360 rows.

## 3. Recipes against our pipeline

Cost baseline: one `cloudDensity` sample is about 6 `valueNoise` calls (5 octaves plus the ridge term). Costs below are per march sample.

**R1 — Blister: open the cavity (T1–T3).**
- New history field `blister` in [0,1], e.g. `smoothstep(0.5, 4, ageMyr)·strength`, with M42 set to 0.9 in the catalogue.
- Shift the envelope centre away from the source: `-n·blister·0.5·R`, where `n = normalize(ionOffset)`.
- Push the cavity centre outward until `|c| + Rc > R`, so the hole breaks through the surface.
- Open the far side of the hole: `d - blister·Rc·max(0, dot(pl - c, n)/Rc)`.
- Move `envelope()` into local space.
- Cost about 0. This is the biggest single lever.

**R2 — Ionization front and density-squared emission (T2, T5, T9, T11).**
- Replace `x` with a front: `x = 1 - smoothstep(f0, f1, (ds/Rs)·rho^(2/3))`.
- Emit `j ∝ rho²·x`.
- Divide `emission.scale` by `exp(σ²)`, which is about 3.3 at σ = 1.1.
- Drive `[O III]` from the same `x` and `ds`.
- Cost: one `pow`, about 0.

**R3 — Dust from neutral gas only (T4–T6, T9).**
- `k = extScale·rho·(1 - x·dustDestroy)`, with `dustDestroy` about 0.8.
- Optional warm-brown veil: `j += albedo·k·exp(-ds/glowR)·starColour`.
- Cost about 0.

**R4 — Ellipsoid and lobed envelope (T7).**
- New history fields `axes` (e.g. 1 : U(0.4,0.9) : U(0.25,0.7)) and `lobeAmp` (0.2–0.5).
- `r = |(pl - envCentre)/axes|`, with edge radius `R·(1 + lobeAmp·(valueNoise(dir·2) - 0.5))`.
- Grow `boundRadiusPc` to match.
- Cost: +1 noise call, about +15%.

**R5 — Foreground dust bank (T4, T10).**
- Absorber only: `bank = smoothstep(-w, w, dot(pl, m) - h + a·valueNoise(pl/λ))`, added to `k`.
- Bias `m` across the bright side.
- Count the bank as neutral density in R2 so it gets a lit rim.
- Cost: +1 noise call, about +15%.

**R6 — Directional structure (T8).**
- Stretch `q` along a field axis `b` by `1/anisotropy` (1–3) in `logStructure`.
- Cost about 0.

**R7 — Shadow-tap pillars (T5, T6).**
- 1–2 taps of a 2-octave density toward the source: `x *= 1 - smoothstep(s0, s1, s)`.
- Skip it at patch range.
- Cost: +35–70%.

**Inside regime (T10):** R1 + R3 + R5 together already give the one-lit-wall, dark-bank zone split.

## 4. Ranked first reshape

1. **R1** — aims at 2-orion-m42-vst, 2-orion-m42-m43-noirlab, 9-orion-hubble-mosaic-inside, 1-heart-and-soul, 4-rcw120-spitzer, 1-orion-region-head-to-toe.
2. **R2 + R3 together** — aims at 3-horsehead-ic434-noirlab, 1-north-america-pelican, 3-carina-landscape-hubble, 1-lagoon-eso, 3-pillars-of-creation-hubble2014.
3. **R4** — aims at 1-california, 1-lagoon-eso, 8-rosette-true-colour, 7-crab-hubble, 7-simeis147.
4. **R5** — aims at 1-carina-eso, 1-north-america-pelican, 1-sadr-gamma-cygni, 9-cosmic-cliffs-jwst-inside, 3-horsehead-euclid.
5. **R7, with R6 alongside** — aims at 3-pillars-of-creation-*, 1-eagle-m16-kpno, 3-elephant-trunk-ic1396a, 5-herschel-star-nursery.

Risks:
- R2 moves the brightness budget, so the lab's brightness probes and tests will shift.
- A blister seen face-on is still roughly round; R4 and R5 are what break that view.
- R3 dims stars behind the cloud more. The star-dust bake still works because it reads `k`.
- `boundRadiusPc` must cover the shifted, stretched envelope, or edges will clip.

## 5. What not to copy

- **False-colour palettes.** This covers the Hubble narrowband images (1-eagle, 3-carina-*, 3-pillars-hubble, 4-bubble), the infrared images (3-cosmic-cliffs-*, 3-pillars-jwst, 4-rcw120, 5-herschel-*, 5-taurus-*, 3-horsehead-euclid, 9-*-jwst-*), and the magenta of the NOIRLab images. Take their structure only. For hue, use 8-lagoon and 8-rosette: muted salmon, dusty lilac, pale blue-white cores and warm brown dust.
- **Dust that glows bright, as in the infrared images.** In visible light, dust is dark.
- **Sub-pixel detail:** globule swarms, fibrils, proplyds, evaporation fuzz. Do not add octaves for them.
- **Survey mosaic borders** in the Herschel images.
- **Supernova-remnant lace** as an emission template. The partial-shell lesson from those images does carry over.
- **Low-contrast reflection nebulae** such as 6-witch-head at their true brightness. They vanish at our resolution.