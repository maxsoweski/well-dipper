# Nebula & molecular-cloud structure — names, sizes, what you'd see (2026-10-03)

Research subagent (opus, web) for the Galactic Engine S1 scope. Sources are numbered at the bottom.
Pixel maths in the original used 0.29°/px (240 rows at 70°). **The game actually renders height/3 rows**
(`RetroRenderer.js:31,812`, FOV 70 `Settings.js:40`): 360 rows on a 1080p monitor ≈ **0.19°/px**, so every
"N px at distance d" below reaches ~1.5× farther in-game.

## 1. Structure taxonomy

| Structure | Physically | Size | Density / column | Looks like | Where |
|---|---|---|---|---|---|
| Giant molecular cloud | cold H₂ + dust, 10⁴–10⁶ M☉ | 5–180 pc | n ≈ 10²–10³ cm⁻³ [1] | optically DARK — hides stars, no glow | parent of everything |
| Clump | forms a cluster | 0.3–3 pc | 10³–10⁴ [2] | dark; bright rim if lit | in GMCs, at filament hubs |
| Dense core | forms one/few stars | 0.03–0.2 pc | 10⁴–10⁵ [2] | opaque (A_V tens) | on filaments, in clumps |
| Filament | dense ridge, many pc long | width ≈ 0.1 pc (debated [5]) [3]; length >10 pc [4] | A_V few–tens | dark threads, bright-edged if lit | the cloud's skeleton |
| Hub-filament system | filaments converging on a hub [6]; massive stars form only in hubs [6b] | hub ~1 pc | hub > filaments | star-shaped dark network, bright/embedded centre | where clusters form |
| Striations | faint streaks ⟂ to filaments, along the magnetic field [7] | ~pc | low | hair-like combing | flank filaments |
| H II region | gas ionized by O/B stars, ~10⁴ K | pc to tens of pc | n_e 10–10³ | EMISSION: Hα red, [O III] teal | carved into a GMC's side |
| Compact/UC/HC H II | young, buried | ≲0.1 / ≲0.03 pc [8] | ≳10⁴ / 10⁶ | invisible optically | deep in cores |
| Strömgren sphere | ideal ionized ball, R_s=(3Q/4παn²)^⅓ [9] | ~pc at n~100 | | uniform glowing ball | model of an H II region |
| Ionization front | ionized/neutral boundary | very thin | | sharp bright edge | H II / PDR boundary |
| Photodissociation region | far-UV-heated neutral layer [10] | ~0.01–0.1 pc | | thin bright rim, dark behind | between front and molecular gas |
| Bright rims | lit cloud surfaces | 0.1–1 pc | | glowing edge around a dark mass | facing the stars |
| Pillars / elephant trunks | dense columns resisting erosion, pointing at the stars [11] | ~1–1.5 pc long [12] | A_V up to ~100 | dark body, bright rim, haze | cavity edge |
| Globules (Bok, cometary, EGGs) | dark blobs; cometary = head + tail away from stars [13][14][15] | 0.1–0.8 pc | 10⁴–10⁵ | dark blobs, bright rim + tail | in/near H II regions |
| Proplyds | evaporating planet-forming disks [16] | ~40–1000 AU | | bright cusp + tail | within ~0.3 pc of the hot stars |
| Bubbles / shells | wind/radiation-blown cavities, ~600 catalogued [17] | e.g. RCW 120 ≈ 3.5 pc [18] | | ring, limb-brightened | around O stars |
| Champagne flow / blister | H II breaks out of the cloud edge (Orion) [19] | | | one-sided bowl, bright against the cloud wall | cloud face |
| Embedded → exposed cluster | e.g. Orion Nebula Cluster [20] | 0.2–2.5 pc | | blue-white group inside the glow | centre of H II region |
| Reflection nebula | dust scattering starlight, blue [21] | ~pc | | faint blue | around B/A stars |
| Dark nebula / dust lane | foreground opaque dust (Horsehead) | 0.1–10s pc | A_V >20 [22] | starless silhouette | anywhere in front of light |
| SNR filaments | edge-on shock sheets [23] | shells tens of pc | | lace: Hα red, [O III] blue | separate class |

**Statistics:** Larson's relations [24][25]; projected power spectrum slope ≈ −2.7 from 8 pc to 0.01 pc
(self-similar, fBm-like) [26]; column-density PDF **lognormal**, plus a **power-law tail** in star-forming
clouds [27].

## 2. Real examples
Orion Nebula M42: 390 pc, ~8 pc, 65′ [28] · Orion A cloud: ~90 pc true length [29] · Eagle M16: 1.74 kpc,
70×55 ly [30]; Pillars ≈4 ly tall [12][11] · Carina: >300 ly [31] · Rosette: ~130 ly, 1.3° [32] ·
Lagoon: 110×50 ly [33] · Taurus MC: 140 pc, ~25 pc [4] · Horsehead: 422 pc [34] · Pleiades reflection [35].

## 3. Angular size by distance (0.29°/px; in-game reaches ~1.5× farther)

| Class (size) | 5000 pc | 1000 pc | 300 pc | 50 pc | 10 pc | 1 pc | 1 / 4 / 20 px at |
|---|---|---|---|---|---|---|---|
| GMC complex (90 pc) | 1.0° | 5.2° | 17° | 84° | fills | inside | 17.6 kpc / 4.4 kpc / 880 pc |
| Large H II (40 pc) | 0.46° | 2.3° | 7.6° | 44° | fills | inside | 7.8 kpc / 2 kpc / 390 pc |
| M42-class H II (8 pc) | 0.09° | 0.46° | 1.5° | 9° | 44° | inside | 1.6 kpc / 390 pc / 78 pc |
| Bubble (4 pc) | | 0.23° | 0.76° | 4.6° | 23° | inside | 780 / 196 / 39 pc |
| Pillar (1.2 pc) | | | 0.23° | 1.4° | 6.9° | 62° | 235 / 59 / 12 pc |
| Clump / globule (1 pc) | | | 0.19° | 1.1° | 5.7° | 53° | 196 / 49 / 10 pc |
| Filament width / core (0.1 pc) | | | | 0.11° | 0.57° | 5.7° | 20 / 5 / 1 pc |
| Proplyd (300 AU) | | | | | | 0.09° | 0.29 / 0.07 / 0.015 pc |

**Surface brightness does not change with distance** [36]: approaching makes a nebula BIGGER, never brighter
per pixel. To the eye most nebulosity is below the colour threshold (~19–20 mag/arcsec²) and reads GREY [37];
rods are blind to Hα, so visual observers see M42 as green/teal [38][39]. Long-exposure photos show H II
regions red/magenta. "Realistic eye" = dim grey-teal; "photo" = red.

## 4. From inside
- **Inside an H II region:** every direction looks through ~R of glowing gas → about half the outside central
  brightness, all around — "a hazy sky in twilight" (forum, low authority) [40]. Near the edge: one hemisphere
  glows, the other is dark. Real features: blazing exciting stars, the dark cavity wall with bright rims and
  pillars, proplyds only within ~0.1 pc.
- **Inside a GMC:** no optical glow; the cloud is the ABSENCE of stars. A_V ≈ 4–5 typical (derived), >20 in
  dense parts [22], ~100 in pillars [11]; surviving stars reddened, E(B−V)=A_V/3.1 [41]. Much of the sky black,
  Milky Way blotted in patches following filament structure; embedded reddened young stars, small blue
  reflection nebulae.

## 5. Recommendations
Visibility tiers: **A** (kpc) whole GMCs as dark patches, large H II, SNR shells · **B** (100–1000 pc) M42-class
H II, bubbles, filament network, reflection glow · **C** (10–100 pc) clumps, globules, pillars, hubs, bright
rims · **D** (<10 pc) filament widths, cores, rim thickness, cometary tails · **E** (<0.3 pc) proplyds — skip.

Techniques: exp(fBm) for a lognormal density, gain tuned so the RENDERED projected spectrum ≈ −2.7 [26][27];
ridged-noise filaments ~0.1 pc converging on hubs [3][6]; SDF cavities/shells opened on one side [19];
shadow-casting from the ionizing star for pillars and cometary globules [11][14]; thin wrinkled shells for SNRs
[23]; distance-independent surface brightness [36].

Uncertain: 0.1 pc filament width [5]; −2.7 slope measured in a diffuse cloud [26]; EGG size [15]; inside-H II
appearance (reasoning + forum); GMC A_V 4–5 and front thicknesses are derived, not cited.

## Sources
[1] britannica.com/science/giant-molecular-cloud · [2] aanda.org/articles/aa/full_html/2015/05/aa23428-14/aa23428-14.html ·
[3] aanda.org/articles/aa/full_html/2019/01/aa32725-18/aa32725-18.html ; arxiv.org/pdf/1710.01030 ·
[4] arxiv.org/pdf/1211.1742 ; arxiv.org/pdf/2601.18259 · [5] arxiv.org/pdf/1611.07532 · [6] arxiv.org/pdf/2109.07489 ·
[6b] aanda.org/articles/aa/full_html/2020/10/aa38232-20/aa38232-20.html ·
[7] sci.esa.int/web/herschel/-/55957-palmeirim-p-et-al-2013 ; aanda.org/articles/aa/full_html/2019/03/aa34399-18/aa34399-18.html ·
[8] arxiv.org/pdf/1809.00404 · [9] astrospheres.tp4.ruhr-uni-bochum.de/stroemgren_radius.php · [10] arxiv.org/pdf/2202.05867 ·
[11] arxiv.org/pdf/2309.14637 ; arxiv.org/pdf/1504.03323 · [12] en.wikipedia.org/wiki/Eagle_Nebula ·
[13] arxiv.org/pdf/1506.01982 · [14] aanda.org/articles/aa/full_html/2013/02/aa20027-12/aa20027-12.html ·
[15] en.wikipedia.org/wiki/Evaporating_gaseous_globule · [16] aanda.org/articles/aa/full_html/2024/07/aa49004-23/aa49004-23.html ·
[17] aanda.org/articles/aa/full_html/2010/15/aa14422-10/aa14422-10.html · [18] arxiv.org/pdf/1806.00724 ·
[19] arxiv.org/pdf/astro-ph/0504221 · [20] academic.oup.com/mnras/article/358/3/742/1026072 ·
[21] apod.nasa.gov/rjn/apod/reflection_nebulae.html · [22] arxiv.org/pdf/astro-ph/0103521 · [23] en.wikipedia.org/wiki/Veil_Nebula ·
[24] aanda.org/articles/aa/full_html/2017/07/aa28088-16/aa28088-16.html · [25] aanda.org/articles/aa/full_html/2010/11/aa15282-10/aa15282-10.html ·
[26] arxiv.org/pdf/1005.2746 · [27] academic.oup.com/mnras/article/449/4/4465/1173181 ; arxiv.org/pdf/1105.5411 ·
[28] en.wikipedia.org/wiki/Orion_Nebula · [29] ui.adsabs.harvard.edu/abs/2018A&A...619A.106G ·
[30] physics.unlv.edu/~jeffery/astro/star/formation/eagle_nebula.html · [31] en.wikipedia.org/wiki/Carina_Nebula ·
[32] en.wikipedia.org/wiki/Rosette_Nebula · [33] en.wikipedia.org/wiki/Lagoon_Nebula · [34] en.wikipedia.org/wiki/Horsehead_Nebula ·
[35] en.wikipedia.org/wiki/Pleiades · [36] en.wikipedia.org/wiki/Tolman_surface_brightness_test ·
[37] clarkvision.com/articles/color-vision-at-night/ · [38] cloudynights.com/forums/topic/490198-can-you-or-cant-you-see-color-from-orions-nebula/ ·
[39] clarkvision.com/articles/astrophotography.m42-trapezium.true.color/ ·
[40] cloudynights.com/forums/topic/900794-how-would-the-night-sky-look-like-from-a-planet-inside-orion-nebula/ ·
[41] arxiv.org/pdf/1706.07109
