# Feature Card — F28 Storm clusters / oval trains
Domain: Storms · Lab status: 🟡 · Build-seq phase: 4b

## 1. Description (WHAT)

Multiple discrete vortices riding the zonal bands of gas worlds — the plural sibling of F27's single great spot. Derives from P17 (vortex/storm formation: zonal shear + convection spin up anticyclones; drivers D8 rotation rate, D5 atmosphere depth, interior heat, condensables; timescales quasi-permanent decades to transient days) — fast spin (D8) sets the jet structure whose shear zones trap vortex families at fixed latitudes. Variants: (1) white-oval train — several same-latitude anticyclones in quasi-regular spacing, e.g. Jupiter's "string of pearls" (~8 white ovals at 40°S, varying 6-9 since 1986); (2) "string of pearls" proper as the named Jovian example; (3) convective plume outbreak — a bright eruptive head shedding a sheared tail that can wrap the whole planet, e.g. Saturn's 2010-11 Great White Spot (~10,000 km head, Earth-wide, tail encircling the globe). WD types: gas, hot-jupiter, sub-neptune. Status `[partial]`: PlanetGenerator emits a deterministic `storms.spots` array but nothing renders it (docs/FEATURES/planet-visual-features.md:269, P17 row :163).

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational) in planet-lod-lab.html — the lab is terrestrial-only today (gas types explicitly deferred, planet-lod-lab.html:22; presets at :2149-2161 are all rocky/icy). Nearest existing machinery it should plug into: (a) generation side already exists — src/generation/PlanetGenerator.js:587-649 deterministically rolls 1-3 storm spots for 40% of gas giants (unit-sphere position avoiding poles, angular size 0.08-0.3, latitude-elongated aspect 1.2-2.5, three color regimes: dark bruise / warm GRS-red / bright Saturn-white), surfaced as `storms` at :693 but never consumed — the production GAS_BODY shader (src/objects/Planet.js:254-262, :296-306) instead fakes one storm from a low-freq snoise^4 threshold; (b) carriage is already reserved — `uStormPosSize[8]` / `uStormParams[8]` / `uStormColor[8]` / `uStormCount` flat uniform arrays, owner Bands domain, status DEFERRED (research/stage-c/REGISTRY-canonical-uniforms.md:42, echoed in the lab's registry comment at planet-lod-lab.html:1779-1781); (c) campaign tracker slots it in build stage 4b with the other Bands/Storms cards (docs/FEATURES/planet-lod-campaign-tracker.md:57). F28 = wire (a) through (b) on top of the future latitude-banded-FBM Bands base.

## 3. Reference images (real + art)

- [real] https://photojournal.jpl.nasa.gov/catalog/PIA21219
  — Juno close-up of one 'pearl' — a closed white oval with a crisp rim sitting inside a darker band; the rim-vs-band contrast is the form to keep.
- [real] https://photojournal.jpl.nasa.gov/catalog/PIA21970
  — White oval of the String of Pearls at 40°S — note the latitude-elongated ellipse and how band streamlines deflect around it (festoon wake).
- [real] https://svs.gsfc.nasa.gov/11038
  — Saturn's 2010-11 record storm (GWS): bright convective head + sheared tail wrapping the planet — the plume-outbreak variant's head/tail anatomy.
- [real] https://science.nasa.gov/resource/spotting-saturns-northern-storm/
  — Cassini full-disk view of the GWS — at planet scale the storm reads as one bright high-contrast band interruption, exactly the scale our distance-20 view shows.
- [art] http://johnwhigham.blogspot.com/2011/11/gas-giants.html
  — Whigham's procedural gas giants — hash-placed storm cones + per-axis rotational swirl distorting stripy band noise; the canonical game-side recipe for vortex trains.
- [art] https://medium.com/@barth_29567/procedural-gas-giants-f2a61bc6bd97
  — Paleologue's stylized gas giants — vertically-compressed FBM bands + recursive domain warp; shows how few ingredients still read as 'Jovian' (good for our low-detail posterized target).
- [art] https://stroemer.cc/procedural-generation-gas-giants/
  — stroemer.cc storm masks — low-freq noise minus constant, clamped, as a sparse multiplier mask gating where swirl detail appears (cert expired; fetch via archive per research doc flag).
- [art] https://parallelcascades.com/gas-giant-curl-simulation/
  — Unity curl-flow gas giant — vortices as rotation injected into a band flow field rather than pasted decals; the 'storms distort the band, not overlay it' look we want.

## 4. Math / modeling notes (HOW, from the field)

Physics: giant-planet vortices live in quasi-geostrophic / shallow-water turbulence — anticyclones spin up in the anticyclonic shear zones between counter-rotating zonal jets, so vortex families sit pinned at one latitude with quasi-regular longitudinal spacing (a vortex street), merging over decades; plume outbreaks (Saturn GWS) are moist-convective eruptions whose bright head gets sheared by the zonal jet into a planet-encircling tail (Cassini ISS dynamics studies, Nature Geoscience 2013). Games/demos model this far more cheaply: per the project's own RESEARCH_high-lod-planet-shaders-2026-06-05.md §3.2, the gas-giant LOD2 stack is **latitude-banded FBM (vertical-stretch) + recursive domain warp + storm-mask/rotational swirl**, all "survives" posterization at med cost. The storm-mask + rotational swirl row gives the exact GLSL idiom: placement via `smoothstep(0.6,0.8,n)` sparse mask (or, better for WD, the already-generated deterministic `storms.spots` centers), swirl via per-center `ang = rotStrength * smoothstep(radius, 0, d); p = c + rot2D(ang) * (p - c)` applied in the local tangent plane BEFORE the band lookup — Whigham packs 100-200 such cones in a 128² cubemap, but a uniform-array loop over ≤8 spots is simpler and matches the reserved `uStormPosSize[8]` carriage (mirrors the existing `shadowMoonPos[6]` pattern). Variant mapping: oval train = N spots sharing a latitude with jittered-regular longitudes (generation-side change in PlanetGenerator's spot placement); aspect 1.2-2.5 elongates the distance metric along latitude; GWS outbreak = one bright spot + an elongated wake mask stretched longitudinally with decaying amplitude. Per §3.5 the high-contrast luminance of spot-vs-band survives the 6-level posterize cleanly. Most promising shader-side approach: loop over `uStormCount` spots inside the Bands `getSurfacePattern`, for each compute tangent-plane offset from the spot center (aspect-scaled), rotate the band-sampling coordinate by `rotStrength * smoothstep(size, 0, d)` so band stripes visibly wind into each vortex, then `mix` toward `uStormColor[i]` inside `smoothstep(size, size*0.7, d)` — storms deform the band field rather than decal over it, which is precisely what makes ovals read as vortices after posterization.

## 5. Isolation recipe (:9223)

Unbuilt — recommended recipe once built. Prereqs: a gas DRIVER_PRESET (e.g. 'Gas (Jovian)') and a gas archetype in planet-archetypes.js (lab presets are terrestrial-only today, planet-lod-lab.html:2149-2161); register the feature as e.g. `stormTrain: { label: 'Storm clusters (F28)', enableKey: 'stormTrainEnabled', archetypes: ['banded-gas'] }` in FEATURES. Then on the :9223 debug Chrome: open planet-lod-lab.html; `window._lab.setPreset('Gas (Jovian)')`; `window._lab.solo('stormTrain')` (gates everything but F28 — note the Bands base F24 may need to stay on as the substrate, so verify whether solo should pair with `state.bandsEnabled = true`); judge train layout/countability at `window._lab.state.distance = 20` (full disk), oval rim + festoon wake at `6`, in-vortex swirl winding at `2.5`. Restore with `window._lab.enableAllFeatures()`. Verify determinism by re-running setPreset and confirming spots return to identical band positions.

## 6. What to judge (UAT checklist)

- [ ] Does each storm read as a discrete closed vortex — a rimmed ellipse distinct from its parent band — in the 6-level posterized envelope, not just a bright blob?
- [ ] Does the train variant read as a family: several same-latitude ovals at quasi-regular spacing (string of pearls), clearly distinct from random noise speckle?
- [ ] Are ovals elongated along latitude (aspect ~1.2-2.5) and confined to their band — never straddling a belt/zone boundary or wandering to the poles?
- [ ] Does the swirl read as rotation — band stripes visibly wind/deflect around each oval (festoon wake) — rather than a decal pasted over an unbroken band?
- [ ] Do the three color regimes (dark bruise / warm GRS-red / bright pale white) each land in a posterize bucket distinct from the parent band, so storms stay legible after dithering?
- [ ] For the plume-outbreak variant: does it read as a bright convective head plus a sheared longitudinal tail trailing along the band, not a second oval?
- [ ] At full-disk distance (~20 radii) do the 1-3 storms stay individually countable, without 4x4 Bayer shimmer fusing them into the band pattern?
- [ ] Are spot positions seed-stable on re-approach (same band, same longitude), so the planet reads as the same world every visit?

## 6.5 Build plan (working-Claude, 2026-06-10 — Phase 4b heavy loop)

F27 landed the whole shader mechanism (uStorm* vec4[8] carriage + stormSwirl + stormColTerms, commit c5c1b86) — F28 is mostly DATA: fill slots 1..7 with seed-derived storm families and restructure the per-frame writer to compose F27 (slot 0) + F28 (slots 1+) under separate enables. GLSL ideally unchanged.

1. **Data:** FEATURES `stormTrain` { label 'Storm clusters (F28)', enableKey 'stormTrainEnabled', archetypes ['gas-giant'] } (NOT the card's 'banded-gas'). PROVINCES `stormTrain` neutral { field: 2, polarity: +1, floor: 1.00 }. PROV_STORMTRAIN = 26 + row + GLSL_NAME line. (The GLSL row exists for the vitest mirror even though the storm loop reads PROV_GREATSPOT's weight — both ≡ 1; note it in a comment.)
2. **Variant by the vigor ramp (one mechanism, three reads):** vigor ≥ 0.7 (Jovian) → PEARL TRAIN: 4-6 bright pale ovals sharing one belt latitude, quasi-regular longitudes (2π/n spacing, ±15% jitter), radius 0.05-0.09, aspect 1.3-1.8, mild same-sign swirl 0.6-1.0; 0.35 ≤ vigor < 0.7 (Saturnian) → PLUME OUTBREAK: bright near-white head (radius ~0.09, rot ~1.2) + sheared TAIL = a second carriage slot at the same latitude offset ~2.5 head-radii east with aspect ~9, rot 0, dimmer color (the elliptical metric stretches it into the along-band streak — no GLSL change); vigor < 0.35 (Neptunian) → 1-2 small bright "scooter" patches (radius ~0.06, white-blue, rot ~0.5).
3. **Band confinement (judging item 3):** pearl/plume latitude SNAPS to a belt center: belt centers sit at bandCoord = 0.5 + m ⇒ latC = (2 + 4m)/bandCount (F24's ladder inverted); |trueLat| = pow(|latC|, 1/bandLatPow), y = sin(trueLat·π/2); pick m via hash from the middle latitudes (|latC| 0.25-0.75). Mirror the JS inversion against the GLSL constants — same state knobs applyDrivers already reads.
4. **Per-frame writer restructure:** compose the array each frame: idx 0 = great spot iff greatSpotEnabled && spotStrength; idx 1..k = train slots iff stormTrainEnabled && trainStrength (= _gas gate); uStormCount = total written. Keep .set() on preallocated vectors (no per-frame allocation).
5. **applyDrivers derivation:** same (macroSeed, stormSeed) PRNG stream EXTENDED (draws continue after F27's — placement decorrelates for free); store train spots as state.trainSpots = [{center, radius, rot, aspect, color, companion:0}, ...]. trainStrength = _gas ? 1 : 0 (terrestrials 0 — pre-check).
6. **GUI:** folder 'Storm clusters (F28)' — driven count display + radius-scale slider (.listen()), 🎲 shares stormSeed reroll (one seed owns ALL storm placement — note in folder), ✓ LAST. featureFolders.
7. **Pre-check:** node table — Jovian: 4-6 pearls one belt lat, longitudes ~2π/n spaced; Saturnian: head+tail same lat, tail east; Neptunian: 1-2 scooters; terrestrials strength 0; total slots ≤ 8 with great spot on; determinism (same seeds → same layout).

v1 scope cuts: tail decay gradient (single dim slot approximates it); vortex merging/animation → out; PlanetGenerator.storms production wiring → integration phase; GWS planet-encircling full wrap → tail caps at the elliptical metric's reach (taste fork).

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
