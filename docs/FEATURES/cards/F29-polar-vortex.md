# Feature Card — F29 Polar vortex
Domain: Storms · Lab status: 🟡 · Build-seq phase: 4b

## 1. Description (WHAT)

F29 Polar vortex (F-storms family, docs/FEATURES/planet-visual-features.md:270) — a permanent cyclonic structure locked to a rotation pole. Derives from P17 vortex/storm formation (:163): shear + convection spin up vortices, fed by drivers D8 rotation rate (fast spin → Coriolis organization), D5 atmosphere density/depth, zonal shear, interior heat, and condensables; timescale quasi-permanent (decades). Three variants: (1) single cyclonic cap — one swirling vortex centered on the pole (Venus double-eye core, Saturn's south-pole hurricane-like eye); (2) polygonal jet — the signature variant, a closed N-sided jet-stream contour around the pole (Saturn's wavenumber-6 hexagon, ~30,000 km across, stable for decades); (3) cyclone-cluster lattice — a ring of discrete cyclones at fixed angular radius around a central one (Jupiter's Juno-observed south-pole pentagon and north-pole octagon/"ditetragon"). Real-body examples: Saturn hexagon, Jupiter poles, Venus. Applies to types: gas, venus, eyeball, and the hex exotic preset (Appendix A :370 lists "F29(hexagon hook)" for hex). Doc status: [partial] — polar darkening only.

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational) in planet-lod-lab.html — the lab has zero F29 machinery (gas types are explicitly deferred per the header comment at planet-lod-lab.html:22, and planet-archetypes.js FEATURES has no storms/gas keys at all). The doc's "[partial] (polar darkening only)" refers to the LEGACY production shader: src/objects/Planet.js:305-306 darkens the gas-giant surface with `polarDark = smoothstep(0.6, 1.0, abs(vPosition.y)/planetRadius); surfaceColor *= 1.0 - polarDark*0.3;` — a latitude fade, no vortex structure. Notably, the generator ALREADY emits unwired polar-vortex data: src/generation/PlanetGenerator.js:630-646 rolls a `polarStorm` for ~15% of gas giants with `{sides: rng.int(5,8), pole: ±1, radius: 0.12-0.22, color}` (explicitly "like Saturn's hexagon"), packed into `storms` at :649/:693 — grep shows nothing in src/objects/Planet.js or src/rendering ever consumes `polarStorm`, so the data contract for the polygonal-jet variant exists and is orphaned. Nearest lab machinery to plug into: the pole-distance coordinate pattern from frostCoverage (planet-lod-lab.html:1379-1396, coldFactor 0 at edge → 1 at pole) and the annular pldBands albedo function (:1420) prove out the "pole-centered radial coordinate driving an albedo/lighting mask" pipeline a vortex combiner would reuse; the future F24 banded-gas combiner is the surface it must hand off to at the jet latitude.

## 3. Reference images (real + art)

- [real] https://science.nasa.gov/photojournal/saturns-hexagon-as-summer-solstice-approaches/
  — Cassini natural-color hexagon: notice the closed six-sided jet contour reads as a sharp boundary between two big flat color regimes (gold haze outside/inside shifts, blue vortex core at center) — exactly a posterize-friendly two-tone read.
- [real] https://www.jpl.nasa.gov/images/pia23557-a-pentagon-of-jovian-cyclones/
  — Juno JIRAM south pole: five discrete cyclones arranged as a pentagon around a sixth central one — each storm is a distinct swirl-with-eye blob, the lattice variant's form target.
- [real] https://www.jpl.nasa.gov/images/pia24967-jupiters-polar-vortices-over-five-years/
  — Five years of Jupiter's polar vortices: the lattice is quasi-permanent — storms keep their ring positions, justifying a static seed-deterministic placement (no per-frame simulation needed).
- [real] https://www.esa.int/ESA_Multimedia/Images/2006/06/Double_vortex_at_Venus_South_pole
  — Venus Express double-eye vortex (~2000 km): a thick-atmosphere rocky world gets a polar vortex too — a small twin-lobed bright/dark swirl core, not a polygon.
- [real] https://sci.esa.int/web/venus-express/-/48596-the-shape-shifting-southern-vortex-of-venus
  — The Venus vortex's morphology is irregular and lobed rather than geometric — the single-cap variant should read as a smeared S-curve swirl, distinct from Saturn's crisp polygon.
- [art] https://smcameron.github.io/space-nerds-in-space/gaseous-giganticus-slides/slideshow.html
  — gaseous-giganticus (Space Nerds in Space): curl-noise-advected gas-giant textures whose bands wind into pole swirls — the stylized 'bands curl into the polar regime' transition we want at the cap boundary.
- [art] https://medium.com/@barth_29567/procedural-gas-giants-f2a61bc6bd97
  — Paleologue's procedural gas giants: latitude-banded FBM + domain warp — the base stack the polar vortex must visually take over from poleward of the jet latitude.
- [art] https://www.artstation.com/artwork/yDe8D8
  — Stylized procedural volumetric gas giant: shows how a reduced palette + strong band/swirl shapes carry the gas-giant read without photoreal cloud texture — close to our 6-level envelope target.

## 4. Math / modeling notes (HOW, from the field)

Academia models the three variants distinctly. (a) Saturn's hexagon is understood as a wavenumber-6 Rossby-wave meander of an eastward circumpolar jet — barotropic instability of the jet selects the azimuthal wavenumber; rotating-tank experiments and shallow-water models reproduce N-gons by tuning jet speed/width. Key insight for us: the polygon IS a jet streamline, so visually it's a closed contour r(θ) = r0·(1 + a·cos(Nθ + φ)) traced as a band, not a filled hex. (b) Jupiter's polar cyclone lattices are treated as "vortex crystals" in shallow-water simulations — stability requires each cyclone to carry an anticyclonic shielding ring, and the ring of M cyclones sits at a fixed angular radius around a central polar cyclone; quasi-static over years (PIA24967), so deterministic seed placement is physically honest. (c) Venus's vortex is a single warm-core swirl with variable lobed morphology. Games/demos never simulate this: the gas-giant stack in our research doc (research/RESEARCH_high-lod-planet-shaders-2026-06-05.md §3.2) is latitude-banded FBM + recursive domain warp for the body, plus the "storm-mask + rotational swirl" primitive (per-center `ang = rotStrength·smoothstep(radius,0,d); p = c + rot2D(ang)·(p−c)`, Whigham-style, centers from integer-cell hash → deterministic) for discrete vortices; gaseous-giganticus gets pole swirls for free from curl-noise advection. All detail should be lighting-routed (perturb N, dither the lighting value) per §3.4, with the cap's color shift reserved as one large low-frequency albedo mask — the allowed albedo channel. Pole-local frame: project object-local pos onto the plane ⊥ the spin axis (gnomonic at the pole) to get (r, θ) with no UV seam or pole pinch — the lab already avoids pole pinch via its 3D-domain approach (planet-lod-lab.html:488), and frostCoverage's coldFactor (:1379-1396) is the existing pole-distance coordinate. Most promising shader-side approach: one polar combiner in the (r, θ) pole frame, dispatched by the orphaned PlanetGenerator `polarStorm` data — variant 2 traces the jet as a dark collar band along r0·(1 + a·cos(sides·θ)) with longitudinal scroll (two-phase flow-map for drift); variant 1 applies the rotational-swirl domain warp (angle ramping toward r=0) to the band-FBM field inside the cap plus a low-frequency cap albedo mask replacing today's polarDark; variant 3 instances M storm-mask+swirl primitives on a ring at fixed r. All three reuse the F28 storm primitive and the F24 band field, fading in poleward of the jet latitude via a smoothstep on |sin(lat)|.

## 5. Isolation recipe (:9223)

Unbuilt — recipe for once it lands. Prerequisite: a gas-giant driver preset (gas types are deferred per planet-lod-lab.html:22; DRIVER_PRESETS at :2149 has no gas entry) and a FEATURES entry in planet-archetypes.js — recommended key `polarVortex` with `enableKey: 'polarVortexEnabled'`, in a new `'banded-gas'` archetype (bodies: Saturn, Jupiter; preset: 'Gas giant (banded)'), so the existing solo plumbing (setFeatureEnables, planet-lod-lab.html:2539; window._lab.solo at :2908) picks it up automatically. Then, in the :9223 debug Chrome (launch per memory/chrome-devtools-9223-launch.md), open the lab and run: `window._lab.setPreset('Gas giant (banded)')`; `window._lab.solo('polarVortex')`; aim the camera down the spin axis with `window._lab.state.pitch = 1.35` (≈ pole-on; use −1.35 for the south pole when the seed put polarStorm there). Distances via `window._lab.state.distance`: 6 — confirm the far read collapses to simple polar darkening; 3 — whole-cap framing, judge polygon/lattice silhouette; 1.5 — jet-edge close-up, judge swirl detail and dither stability. Sweep the GUI `sides` knob 5→8 to verify the polygon count drives the contour, and toggle the F24 bands feature back on to judge the band→cap handoff.

## 6. What to judge (UAT checklist)

- [ ] Does the polygonal jet read as a closed N-sided contour locked to the spin pole — a traced band with flat-ish straight segments and rounded corners — rather than a wobbly circle or a filled hexagon, in the 6-level posterized envelope?
- [ ] Does the cap interior read as a distinct circumpolar regime (one large low-frequency color/value shift, like Cassini's gold-outside/blue-core) instead of a hard latitude cutoff line or banding artifact?
- [ ] Does motion read as rotation about the pole — streaks curving inward with increasing twist toward the center — and does the Bayer dither stay stable (no shimmering blocks) as the swirl scrolls?
- [ ] In the lattice variant, do the cyclones read as discrete same-sized swirl blobs arranged in a ring around one central vortex, each with its own eye, rather than merging into a single smear?
- [ ] Does the feature stay anchored to the rotation axis with no seam, pinch, or sliding as the planet spins and the camera orbits over the pole?
- [ ] Does the LOD ramp behave: from whole-disk distance the cap compresses to a simple polar darkening (today's Planet.js read), with the polygon/lattice structure emerging only on approach, pop-free?
- [ ] At the jet latitude, do the zonal bands (F24) visibly hand off to the polar regime — bands terminating at or winding into the collar — rather than overlapping through it?
- [ ] Does the Venus-style single-cap variant read as an irregular lobed swirl core (shape-shifting S-curve) clearly distinct in character from the crisp geometric Saturn polygon?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
