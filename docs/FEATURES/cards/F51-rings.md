# Feature Card — F51 Rings
Domain: Crosscutting · Lab status: 🟡 · Build-seq phase: 4c

## 1. Description (WHAT)

F51 (L2 crosscutting table, docs/FEATURES/planet-visual-features.md:345): planetary ring system — banded ringlets + a dominant Cassini-style gap + shepherd-moon gaps + the planet's shadow falling across the annulus. Unlike surface features it has no single P#/D# row; its physical chain is encoded in PhysicsEngine §11 instead: origin ('roche' | 'accretion' | 'collision' | 'captured') sets composition and color family (bright ice / dark rock / brown dust / mixed debris); the Roche limit (2.44·R·(ρp/ρm)^⅓) sets the inner edge; the innermost moon clips the outer edge; system age decays density (icy-ring lifetime ~200 Myr → fresh dense vs tenuous remnant); moon 2:1 and 3:1 mean-motion resonances carve gaps; gaps partition the disk into up to 16 ringlets. Variants: dense multi-banded icy disk (Saturn A/B/C + Cassini Division + Encke gap with shepherds Pan/Prometheus/Pandora) · narrow dark ringlets (Uranus) · faint dusty ring (Jupiter) · ring arcs (Neptune) · exotic giants (J1407b candidate, ringed centaur Chariklo). Status: [current] inline path in production; [partial] dead RingRenderer.js multi-band, never instantiated.

## 2. Current shader approach (HOW, as-built)

Built in PRODUCTION, absent from planet-lod-lab.html (no ring stage, mesh, or uniform exists in the lab — grep for ring there only hits aurora ringMask and cryo bands). Production inline path: src/objects/Planet.js _createRing() (1105-1235) — THREE.RingGeometry(innerR, outerR, 64) rotated into the equatorial plane (1111-1114); fragment shader parameterizes t = (dist-innerR)/(outerR-innerR), fakes banding with two sine waves sin(t*30) and sin(t*12+1) → density + 2-color mix (1194-1198); a HARDCODED Cassini-like smoothstep gap at t≈0.4-0.51 (1200-1202); shepherd gaps as up to 6 moon-orbit notches via setRingGaps() (1241-1255, gap width = moon.radius*4); planet shadow as an analytic cylinder test — cross(vRelWorldPos, lightDir) vs planetRadius (1214-1223, shadow also drops alpha to 0.15 so stars show through); transparency via Bayer dither-discard (1225) and 6-level posterize (1227) — the retro envelope is already honored. Generation: PlanetGenerator.js:509-555 rolls per-type ring chance and calls generateRingPhysics() (PhysicsEngine.js:766-905: Roche-limit inner edge 844, moon-clipped outer edge 846-857, age-decay density 859-864, 2:1/3:1 resonance gaps 866-884, ringlet partition 886-900). DEAD PATH: src/rendering/objects/RingRenderer.js:38 consumes the full physics ringlets[]/gaps[] (16 ringlets, 8 gaps, composition-driven COMPOSITION_COLORS at line 28) in a per-fragment loop (208-235) — but it is never imported or instantiated anywhere; the physics data is generated and stored on rings.physics yet the live inline shader ignores it and renders the sine fake. Nearest lab machinery to plug into: the FEATURES solo registry in planet-archetypes.js:6 and the lab's DRIVER_PRESETS/deriveUniforms pipeline (planet-lod-lab.html:2149, 2164).

## 3. Reference images (real + art)

- [real] https://photojournal.jpl.nasa.gov/catalog/PIA08885
  — F-ring shepherds Prometheus and Pandora flanking a narrow ringlet — the form a shepherd gap/confinement should imply even when the moons themselves are sub-pixel.
- [real] https://photojournal.jpl.nasa.gov/catalog/PIA11657
  — Mimas' shadow straddling the Cassini Division at equinox — the canonical look of THE dominant gap: one wide dark clearing separating two dense bands.
- [real] https://photojournal.jpl.nasa.gov/catalog/PIA17199
  — Saturn's shadow sweeping across the rings: lit particles below, shadowed above — the shadow is a sharp-edged bite across the annulus, not a dimming gradient.
- [real] https://www.jpl.nasa.gov/images/pia05421-ringscape-in-color/
  — Natural-color ringscape: sandy/pink/grey banding within the B ring — the palette range (2-3 muted hue families, brightness-led) our 6-level posterize must compress to.
- [real] https://en.wikipedia.org/wiki/Rings_of_Saturn
  — A/B/C structure, division widths, and optical-depth profile — the 1-D radial density function the shader is really drawing.
- [art] https://www.artstation.com/artwork/nEEvJe
  — Procedural ring shader (Adam Porembiński) — shows which knobs matter artistically: band frequency, contrast, gap placement, edge falloff.
- [art] https://helianthus-games.itch.io/pixel-art-planets
  — 250+ 64px pixel-art planets incl. ringed ones — proof of how FEW distinct bands (3-5) still read unmistakably as 'ringed planet' at low resolution.
- [art] https://www.shadertoy.com/view/WfXyzB
  — Shadertoy 'planetary rings' — live example of 1-D noise-over-radius banding carved by smoothstep gaps, the technique class we'd adapt under the dither envelope.

## 4. Math / modeling notes (HOW, from the field)

Academically a ring system is a 1-D radial optical-depth profile τ(r) on a razor-thin disk: the inner edge sits at the Roche limit (2.44·R·(ρ_planet/ρ_moon)^⅓ — already in rocheLimit(), PhysicsEngine.js:776); gaps are cleared at mean-motion resonances with moons, a_gap = a_moon·(p/q)^(2/3) by Kepler (the Cassini Division ↔ Mimas 2:1; the code computes 2:1 and 3:1 gaps at PhysicsEngine.js:874-883); narrow ringlets are confined by shepherd-moon torques (Goldreich-Tremaine); density decays with age via viscous spreading and micrometeoroid pollution (the ageFactor exponential at 859-864). Games/sims collapse all of this to that 1-D profile: render a flat annulus and sample either a baked 1-D density LUT or a procedural 1-D FBM over normalized radius t, with smoothstep notches for gaps; planet shadow is an analytic cylinder-occlusion test along the light direction (already implemented, Planet.js:1214-1217); dusty rings additionally brighten when backlit (forward scattering) — an optional [needs-adaptation] extra. In the research doc's vocabulary the whole feature is naturally 'lighting-routed': τ(r) drives the ALPHA dither-discard (Bayer threshold → translucency that survives the retro envelope with zero blending/sorting), hue stays a 2-color composition mix posterized to 6 levels, and the radial band frequency needs the fwidth band-limiting clamp so fine ringlets fade to their mean at grazing angles instead of moiréing against the 4×4 Bayer grid (the sine fake at sin(t*30) currently has no such clamp). Most promising shader-side approach: resurrect the dead RingRenderer ringlet/gap loop as a single 1-D density combiner — ringlet rectangles with smoothstep edges × resonance-gap notches × a low-octave deterministic 1-D FBM(t) for fine ringlet texture — evaluated from length(vPos.xz), keeping the existing dither-discard alpha, cylinder planet-shadow, and 6-level posterize untouched. This swaps the fake sine bands for the already-generated physics chain at near-zero added fragment cost, and the fwidth clamp on t handles the one new failure mode (edge-on shimmer).

## 5. Isolation recipe (:9223)

UNBUILT in the lab — recommended recipe once built: (1) register a FEATURES key in planet-archetypes.js:6, e.g. rings: { label: 'Rings (F51)', enableKey: 'ringsEnabled', archetypes: [...] }, so the lab's setFeatureEnables() solo plumbing (planet-lod-lab.html:2539-2569) picks it up automatically; (2) add a ringed host preset to DRIVER_PRESETS (planet-lod-lab.html:2149) — none of the six existing presets is a gas giant, so either add 'Gas giant (ringed)' or hang the ring off 'Frozen (airless)' for first light. Then, on the dedicated :9223 Chrome (see memory/chrome-devtools-9223-launch.md; verify liveness with mcp__chrome-devtools__list_pages, NOT curl), open the lab page and run: window._lab.solo('rings'). Distances via window._lab.state.distance (lab range 1.1-30 radii, planet-lod-lab.html:2106): 12 for the full annulus face-on (rings span roughly 1.2-4 planet radii); 25 for the far-silhouette readability check (do bands still read at a handful of pixels?); 3-5 hovering near the ring plane for the planet-shadow bite, gap edges, and dither-translucency against the starfield. Sweep pitch between face-on and edge-on to exercise the grazing-angle moiré case.

## 6. What to judge (UAT checklist)

- [ ] Does the ring read as a flat annulus locked to the planet's equatorial plane (tilting with axial tilt), not a screen-space billboard, in the 6-level posterized envelope?
- [ ] Do the bands read as discrete concentric ringlets of differing density — 3-5 distinguishable light/dark bands — rather than a smooth radial gradient flattened by the posterizer?
- [ ] Does ONE dominant wide gap (the Cassini analog) stay readable at far distance, with thinner resonance/shepherd gaps appearing as crisp clearings only as the camera closes?
- [ ] Does the planet shadow read as a sharp-edged bite sweeping the far-side arc of the ring — and do stars remain visible through the shadowed region (alpha drop), not blocked by opaque black fragments?
- [ ] Does the Bayer dither-discard transparency read as translucent ice/dust at every density level, with no sorting or halo artifacts where the ring crosses the planet limb?
- [ ] Do composition families survive the posterize as distinguishable identities — bright cool ice vs dark grey rock vs warm brown dust — within the 6-level budget?
- [ ] At grazing/edge-on angles, do the radial bands stay stable instead of shimmering into moiré against the 4x4 Bayer grid (the band-limiting behavior)?
- [ ] Does ring presence/density vary believably across bodies (fresh dense disk vs tenuous old remnant), reading as a property of the world rather than a fixed decal?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
