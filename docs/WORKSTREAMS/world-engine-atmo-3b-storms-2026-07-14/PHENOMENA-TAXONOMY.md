# PHENOMENA-TAXONOMY.md — giant-atmosphere phenomena, increment #3b

> **Status:** DRAFT pending Max's ratification (designDecision 4 build-sequencing gate — slices P/V build against this doc only after Max signs off).
> **Ratification record:** ⬜ *unratified* — Max's sign-off to be recorded here (date + verbatim "ratified" / change-requests).
> **Produced:** 2026-07-14, Slice R synthesis over three research reports (Jupiter/Saturn · ice giants · exotic giants) + the #3a code substrate (`climate-e5.js`) + the existing storm render primitives (`planet-lod-height.glsl.js` `stormSwirl`/`stormColTerms`/`polarVortexCol`).
> **Satisfies:** AC-TAX. This is the load-bearing design source-of-truth that #3b (and every later giant-facing atmosphere increment) builds against.

---

## 0. How to read this doc

This taxonomy answers Max's three asks (intent.md): (1) *"figure out all the different kinds of atmospheric phenomena and how they can differ visually"*; (2) make giant bands read like *"ink dropped in water"* rather than clean stripes; (3) make a great spot stop *"reading as a simple oval."* It pins, per phenomenon, **what we paint and why**, **which field drives it**, **which render primitive expresses it**, and **whether it ships IN #3b or is DEFERRED to a named later increment.**

### 0.1 Static end-state discipline (non-negotiable, program-wide)

Every phenomenon is painted **place-once** — no `uTime` enters any storm term (designDecision 2; preserves the shipped "Static in v1" contract). **Time-character informs WHAT we paint, never motion.** A Neptune dark spot is a snapshot of a multi-year birth→drift→death arc: we render *one lifecycle phase* as a seeded age state, we do not animate the arc. A Saturn Great White Spot is a ~30-year-recurrence outbreak: if painted at all, it is a static "outbreak epoch" state, not a spreading animation. The per-vortex **seeded phase bank** ships as place-once scalars (for #4 lightning flicker / #5 brown-dwarf drift / #8 Mars oscillator to consume downstream) — #3b itself animates nothing.

### 0.2 Render-lever legend (the carriage-reuse + one-new-attribute envelope — designDecision 6)

Every RENDER MECHANISM below must live inside this envelope. No new uniforms for core storms; exactly **one** new baked vertex attribute (the mask).

| Lever | What it is | Source |
|---|---|---|
| **`uStormPosSize[i]`** (vec4) | vortex center xyz + angular radius R | existing carriage, filled by the new writer |
| **`uStormParams[i]`** (vec4) | `.x` rotStrength (swirl; sign = cyclonic/anticyclonic) · `.y` aspect (elliptical stretch) · `.z` mode (0 warm anticyclone / 1 dark cyclone) · `.w` companion (CH₄ bright cloud) | existing carriage |
| **`uStormColor[i]`** (vec3) | vortex tint — **the chromophore-age output** (white→red ramp) | existing carriage |
| **`stormSwirl(n)`** | Rodrigues domain-warp: bands *deflect and wrap* around each oval → collar/moat + interior spiral "for free" | existing GLSL primitive, extended |
| **`stormColTerms(n,col)`** | core elliptical tint + pale collar luminance ring (0.6R–1.0R) + companion Gaussian | existing GLSL primitive, extended |
| **`polarVortexCol(n,col)`** | polar combiner, three modes: **0** single-cap+lobes · **1** polygonal jet (hexagon `r0·(1+amp·cos(N·θ))`) · **2** cyclone-cluster lattice (central + M-ring dimples/eyes) | existing GLSL primitive, extended |
| **⭐ storm/convection MASK** | **THE one new baked vertex attribute** — continuous [0,1], shear-correlated, maxima at placed vortices | **new (#3b)**; DAG consumers #4/#5/#8 |
| **band-boundary filamentation term** | new GLSL reading existing `aShear` + the new mask → the "ink in water" | new GLSL (#3b), no new uniform |

### 0.3 Driving-field legend (which #3a/#3b field controls a phenomenon)

`shear argmax` = the anticyclonic-shear extremum of `jetShear(lat,P)` (vortex placement, AC-WRITER c) · `PV staircase` = potential-vorticity-adjusted jet profile the argmax runs over (new #3b machinery) · `mask` = the new storm/convection mask · `aShear`/`shearMag` = existing #3a `|du/dφ|` · `u(lat)` = existing #3a signed jet field · `age scalar` = per-vortex seeded chromophore age (AC-FIELDS b) · `phase` = per-vortex seeded place-once phase bank · `T`/`W` = #3a Ward insolation field · `haze` = #3a `hazeMute`/`contrast`.

### 0.4 Confidence flags (carried verbatim from research; do not re-derive)

`observed` = direct imaging/spacecraft · `model-predicted` = GCM/theory, robust but not directly imaged (reports 1/2 "model", report 3 "SIMULATED") · `speculative` = plausible, weakly constrained · `†unverified` = a specific number from a researcher's training, not re-fetched this session.

### 0.5 Regime note

The #3a engine lights five presets: **Jovian, Saturnian, Neptunian, Sub-Neptune, Hot-Jupiter** (`E5_PRESET_REGIME`). **Uranian is a taxonomy regime with no current preset** — physically it is *Neptunian-regime + high obliquity (Ward hot-poles inversion) + thick haze + low internal heat*. Whether #3b adds a distinct Uranian preset or realizes it as a Neptunian variant is an open question (§9). Uranus's defining low-internal-heat driver is one of the three **frozen constants** (`internalHeat`/`dissipation`/`shellDepthFrac`) → the Neptune-vs-Uranus contrast is routed to the **derive-not-freeze variety increment** (designDecision 3), not #3b.

---

## 1. Cross-cutting mechanisms (apply across regimes — defined once)

### 1.1 Chromophore aging states — white→red *(required family: chromophore aging states)*

| Field | | |
|---|---|---|
| **VISUAL SIGNATURE** | A single "possibly universal" red chromophore (Carlson/Baines): a thin aerosol cap above the main deck. One material, two knobs (particle size 0.12–0.29 µm, optical depth 0.06–0.76) reproduces the whole gamut — pale Equatorial-Zone cream → tan belts → orange → GRS brick-red. **Aging logic:** fresh upwelled NH₃ ice = white (age≈0); long residence at altitude + UV dosing thickens/reddens the cap (age→1). Oval BA is the live intermediate (its precursor white ovals stayed white ~60 yr from their ~1939 formation, merged 1998–2000; Oval BA then reddened 2005–06). | |
| **DRIVING FIELD** | **age scalar** (per-vortex seeded, AC-FIELDS b) → monotonic white→red ramp. Anticyclones / raised long-lived features carry high age; fresh upwelling zones ≈0. | |
| **RENDER MECHANISM** | `uStormColor[i]` set from `age → hue ramp` (white→cream→tan→orange→brick-red); the color feeds the existing `stormColTerms` core tint. **Two vortices of different seeded age on one planet must read visibly different (AC-VIS c).** | |
| **REGIME APPLICABILITY** | Jovian (strong), Saturnian (muted by haze — §2.4), ice giants (dark-spot color is *clearing*, not reddening — a low-age/dark branch of the same ramp). | |
| **DISPOSITION** | **IN-#3b** → AC-FIELDS(b), AC-VIS(c). | |
| **CONFIDENCE** | `model-predicted` (Cassini-spectra fit, lab-supported) + `observed` color-history; chromophore *identity* (NH₃+C₂H₂ photoproduct vs NH₄SH) remains scientifically unresolved. | |

### 1.2 Haze mutes *(required family: haze mutes)*

| Field | | |
|---|---|---|
| **VISUAL SIGNATURE** | A global veil that **desaturates, lowers contrast, softens/blurs boundaries, and lifts the brightness floor.** This is the *master switch that keeps Saturn from reading identical to Jupiter* and keeps sub-Neptune/Uranus pale. Applied to storms: it softens the "ink-in-water" into gentle marbling and mutes chromophore saturation. | |
| **DRIVING FIELD** | **haze** (#3a `hazeMute` → `contrast = 1 − hazeMute·HAZE_CONTRAST`, already computed in `resolveParams`). #3b's new work is *applying the same veil to the storm/mask/turbulence terms*, not inventing the field. | |
| **RENDER MECHANISM** | Existing #3a contrast lever, extended to gate storm-color saturation, collar contrast, and the filamentation term amplitude. No new uniform. | |
| **REGIME APPLICABILITY** | Saturnian (high), Sub-Neptune (very high, 0.7), Uranian (high), Neptunian (low, 0.1), Jovian (0). | |
| **DISPOSITION** | **IN-#3b** → AC-LIVE (sub-Neptune haze-muted), AC-VIS(a) (turbulence amplitude gated). | |
| **CONFIDENCE** | `observed` (qualitative + spectral); exact optical depths `model-predicted`. | |

---

## 2. JOVIAN (gas-giant) — the high-contrast, storm-rich reference

| # | NAME | VISUAL SIGNATURE | DRIVING FIELD / PHYSICS | RENDER MECHANISM | DISPOSITION | CONF |
|---|---|---|---|---|---|---|
| 2.1 | **Belt/zone turbulent boundaries** *(req. family)* | Wavy, curling laminar→turbulent interfaces between bands: Kelvin-Helmholtz billows, cusps, von-Kármán streets strung along the shear line. Dye drawn along a shear interface — the literal *"ink in water."* Turbulence lives on the **gradient**, not band interiors. | `aShear` (`|du/dφ|`, peaks at jet cores/band edges, ≈0 at band centers) + **mask**. Turbulence amplitude ∝ shear. | **NEW band-boundary filamentation term** reading `aShear`+mask, extending the existing recursive domain-warp (`bandWarpField`). Active where `|shear|`/mask high; absent where low; off when disabled. | **IN-#3b** → AC-VIS(a), AC-LIVE, AC-UAT | `observed` morphology + `model-predicted` instability |
| 2.2 | **Folded filamentary regions (FFRs)** *(req. family)* | Sprawling turbulent fields of billowing cumulus churned into filaments, dark clear lanes between, embedded eddies. Concentrated in **cyclonic belts poleward of ~40°** (a North-Polar Filamentary Belt near 66–70° marks the ordered→chaotic transition). | `shearMag` + **sign of shear** (cyclonic, poleward-of-prograde-jet side goes to full chaos; anticyclonic side stays cleaner) + mask. | Same filamentation term as 2.1, **intensified on the cyclonic side** (character split by shear sign) and toward high latitude. | **IN-#3b** (core mask+shear) → AC-VIS(a), AC-LIVE. *Cyclonic-vs-anticyclonic character asymmetry* flagged as a possible in-scope refinement (§9 Q8). | `observed` (Juno JIRAM/JunoCam) |
| 2.3 | **Great Red Spot — GRS-class anticyclone** *(req. family)* | Single dominant anticyclonic oval, brick-red, in the S-Tropical/SEB boundary (~22°S), long axis ~1 Earth-diameter, aspect ~0.7, narrow high-velocity collar, quiescent higher-colder core; the belt flows *around* it. | **shear argmax** (strongest anticyclonic-shear latitude → largest slot; lowest-lat tie-break) over the **PV staircase** · **age scalar** → reddest chromophore. Size is an epoch parameter (shrinking IRL), painted static. | `uStormPosSize[0]` max size, `uStormParams.z=0` (warm), `stormSwirl` (bands wrap → collar/moat + interior spiral) + `stormColTerms` core; `uStormColor` = age ramp (max red). | **IN-#3b** → AC-WRITER(c), AC-LIVE, AC-VIS(b), AC-UAT | `observed` |
| 2.4 | **GRS turbulent wake** *(req. family: GRS + wakes)* | The single most turbulent patch on the planet — a field of fine filaments/curls "torn tissue," anchored **upstream (west)** of the GRS where a deflected westward jet collides with an eastward jet. | Anchored to the primary vortex's **upstream edge**; local `shearMag`/mask elevated in a trailing cone. | **NEW wake term** — extend `stormColTerms` (or bump the mask) with an upstream turbulence cone anchored to the slot. AC-VIS(b) "wake detail." | **IN-#3b** → AC-VIS(b). *Dedicated wake term vs. emergent-from-swirl is §9 Q5.* | `observed` |
| 2.5 | **Vortex streets / storm trains** *(req. family)* incl. String of Pearls | Chain of evenly-spaced same-latitude ovals (historically 6–9 white ovals marching along ~40°S) — a beaded necklace at one latitude; von-Kármán streets along shear lines. | Multiple slots at the **shared argmax latitude** (argmax + next-N shear maxima), evenly-spaced longitudes from **seeded phase**. | Multiple `uStorm[i]` slots at one latitude; longitude from the phase bank. | **IN-#3b** → AC-LIVE ("vortex street/train"), AC-WRITER | `observed` |
| 2.6 | **White ovals + merge / Oval-BA intermediate** | Bright high-albedo anticyclones (fresh NH₃ ice, no chromophore yet); Oval BA = white→red partially-reddened. | **age scalar** low (white) → intermediate (reddened). | `uStormColor` via age ramp; same slot/swirl as 2.3 at smaller size. | **IN-#3b** → AC-VIS(c) (age differentiates two vortices) | `observed` |
| 2.7 | **Brown barges (cyclonic)** *(req. family: barges)* | Elongated dark reddish-brown **cyclonic** cloud-clearing features (NEB), longer/thinner than white ovals — the opposite polarity to white ovals. | Cyclonic slot: **shear sign** (cyclonic latitude) → `mode=1` dark; high **aspect** (elongated); dark-brown color (cloud-clearing, deep warm material). | `uStormParams.z=1` (dark bruise) + `.y` high aspect (elongated) + dark tint. Establishes the cyclonic-dark↔anticyclonic-bright polarity axis. | **IN-#3b** → AC-LIVE (spots), AC-WRITER | `observed` |
| 2.8 | **Festoons + 5-µm hot spots** *(req. family: festoons/hot-spots)* | Blue-grey cloud-free festoon filaments trailing SW into the EZ (~7°N); dark gaps between = 5-µm thermal hot spots (Galileo probe entry). A wavenumber ~8–10 equatorial Rossby-wave chain of cloud-clearing windows. | Equatorial Rossby wave → **azimuthal wavenumber** chain of dark notches + thermal windows. Needs an azimuthal-wave mask modulation + **thermal emission through the gap** — neither is #3b machinery (mask is shear-correlated/zonal; emission is #4). | Would need azimuthal-wave mask term + emission glow. | **DEFERRED → #4 emission-v2** (thermal hot-spot glow is an emission feature; the festoon streaks ride the same wave). | `observed` (festoons, hot spots) + `model-predicted` (wave count) |
| 2.9 | **Ammonia mushball convection / shallow lightning** | Tall bright convective towers punching the deck; "shallow lightning" high in the water-NH₃ cloud; patchy NH₃ depletion → patchy cloud opacity. | **mask** granularity + #3a `mushball` (aMush) field. The *lightning* is a Poisson process on the mask. | Mask non-uniformity (patchy opacity) is IN; the lightning glyphs are #4. | Mask texture **IN-#3b** (AC-FIELDS a); **lightning DEFERRED → #4 emission-v2** (Poisson on mask — the mask's named consumer, AC-0). | `observed` (shallow lightning) + `model-predicted`→`observed`-supported (mushballs) |
| 2.10 | **Polar cyclone clusters (octagon/pentagon→hexagon)** *(req. family: polar clusters)* | Each pole: a central cyclone ringed by a regular polygon of circumpolar cyclones (N: 8 north, 5→6 south), packed edge-to-edge with spiral arms. A **cluster of discrete cyclones** (distinct from Saturn's single polygonal jet). | Polar combiner **lattice** — central + M-ring; N a per-regime constant (Jupiter ~8/5). | `polarVortexCol` **mode 2** (central cyclone disc + M-ring dimples/eyes, `uPolarRing`). | **IN-#3b** → AC-LIVE (polar structure), AC-PARITY (uPolar slots) | `observed` (Juno) |
| 2.11 | **Belt fades / NEB expansion (epoch state)** | Whole belts fade to white (SEB 2009–10) then revive; NEB width cycles. A global contrast/width epoch swing. | Belt width/darkness as an **epoch parameter** — a seed-varying band-contrast state, i.e. exactly the frozen-constant territory. | Would modulate #3a band contrast/width per epoch. | **DEFERRED → derive-not-freeze variety increment** (belt width/darkness gain seed variety there). | `observed` |

**Static-end-state notes for Jovian:** GRS *size shrink* and belt *fades* are time-arcs → painted as static size/contrast values in #3b; the "which epoch" knob belongs to the variety increment. The vortex-train longitudes vary per seed (phase), latitudes repeat per the frozen-constant carve-out (designDecision 3).

---

## 3. SATURNIAN — the hazed, hexagon-poled sibling

| # | NAME | VISUAL SIGNATURE | DRIVING FIELD / PHYSICS | RENDER MECHANISM | DISPOSITION | CONF |
|---|---|---|---|---|---|---|
| 3.1 | **North-polar hexagon + central cyclone** *(req. family: Saturn hexagon mode)* | A near-perfect six-sided jet boundary at ~78°N (each side wider than Earth), a subtle color/cloud boundary, with a compact bright central polar cyclone ("the eye"). The hexagon is a **jet streamline**, not a storm. | Polar combiner **polygon** mode, N=6 — a wavenumber-6 Rossby meander of the polar jet. Distinct from Jupiter's cluster. | `polarVortexCol` **mode 1**: `rJet(θ)=r0·(1+amp·cos(6θ))` dark collar + two-tone cap tint + central cyclone. | **IN-#3b** → AC-LIVE (hexagon mode explicitly named) | `observed` (hexagon, cyclone) + `model-predicted` (formation, debated) |
| 3.2 | **South polar cyclone / eyewall (no polygon)** | Both poles host cyclonic vortices; the south pole shows an eye-walled hurricane-like structure (clear eye + towering cloud walls) — no hexagon there. Pole asymmetry is real and paintable. | Polar combiner **cap** mode (mode 0) + an eyewall bright-collar ring; no polygon. | `polarVortexCol` **mode 0** cap, extended with a bright eyewall collar; pole-asymmetric params (N pole polygon, S pole bare cyclone). | **IN-#3b** → AC-LIVE (Saturnian polar structure) | `observed` (Cassini) |
| 3.3 | **Great White Spot (planet-encircling outbreak)** | A brilliant white convective head that shears zonally into a planet-encircling turbulent band (~30-yr recurrence; 1876…2010). Head + 360° smeared tail. | A rare convective **outbreak epoch** — a bright localized head + zonally-smeared turbulent tail at one latitude. A transient, best represented as an optional static epoch state. | Would need a storm-mask "outbreak" mode (bright head + zonal turbulent ring). | **DEFERRED → derive-not-freeze variety increment** (outbreak epoch as a seed-varying state; §9 Q7 groups all outbreak/epoch states there). | `observed` (multiple events, Cassini 2010–11) |
| 3.4 | **Muted palette / haze veil** *(req. family: haze mutes)* | Pale gold/butterscotch, low-contrast, soft-edged banding vs Jupiter's saturated sharp browns/whites/reds. The primary lever that keeps Saturn ≠ Jupiter. | **haze** (thick tropospheric photochemical haze; §1.2). | Existing #3a contrast lever applied to bands + storms + filamentation (desaturate, soften, lift floor). | **IN-#3b** → AC-VIS(a) (turbulence gated), §1.2 | `observed` + `model-predicted` (optical depths) |
| 3.5 | **Ribbon jet / fewer-broader bands** | Fewer, broader, faster jets than Jupiter (dominant super-fast prograde equatorial jet ~400–500 m/s†) → fewer wider bands. | #3a `u(lat)` / Rhines wavenumber (rotation, radius) — **substrate, not a #3b phenomenon.** | Already emerges from #3a `rhinesWavenumber`. | *(context; #3a)* — storm placement inherits the wider bands. | `observed` (profiles); ~500 m/s figure `†unverified` |

---

## 4. NEPTUNIAN (ice giant) — transient dark spots + methane caps

| # | NAME | VISUAL SIGNATURE | DRIVING FIELD / PHYSICS | RENDER MECHANISM | DISPOSITION | CONF |
|---|---|---|---|---|---|---|
| 4.1 | **Great Dark Spot — ice-giant dark spot** *(req. family: ice-giant dark spots)* | Dark elliptical anticyclone (~Earth-sized, ~22°S†), ≥10% darker than the sky-blue background — a *cleared hole* (sits ~50 km above the deck, cloud-free interior showing darker aerosol below), zonally elongated, rolls anticyclonically. | **shear argmax** (anticyclonic) placement; darkness = deep-aerosol *clearing* (`mode=1`), **not** chromophore reddening; **age/phase scalar** picks the lifecycle phase. | `uStormParams.z=1` (dark) + `stormSwirl` + `stormColTerms` (dark core, cleared); size/aspect from slot. | **IN-#3b** → AC-LIVE (Neptunian dark spot), AC-WRITER | `observed` (Voyager 2) |
| 4.2 | **CH₄ bright companion clouds** *(req. family: CH₄ companions)* | Bright white methane-cirrus clouds ~50–100 km *above* and offset from the dark core (orographic — the rising vortex column is the "obstacle"). Fast-responding; can persist even when the dark core is invisible. | **companion** param, **ice-giant-regime-only** (AC-FIELDS c); adjacent to parent dark spot. | `stormColTerms` companion Gaussian (`uStormParams.w`) — the primitive already exists (F27 GDS variant); #3b derives it from physics + gates it to ice-giant regime. | **IN-#3b** → AC-FIELDS(c), AC-LIVE (companion adjacent) | `observed` |
| 4.3 | **Dark-spot lifecycle phase (precursor / mature / dissipating)** | Birth: 2–3 yr of bright companion clouds *before* the dark core appears. Mature: dark core + offset cap, drifts in latitude. Death: equatorward migration → dissolution, or fade-in-place (weak contrast near equator). | **age/phase scalar** → which phase is painted: precursor (companion only, no dark core) · mature (dark core + cap + lat offset) · dissipating (weak contrast, near-equator). Static end-state = **pick one phase.** | Age scalar maps to contrast + latitude offset + companion presence across the same slot primitives. | **IN-#3b** → AC-FIELDS(b), AC-WRITER. *How many phases / whether to paint the "invisible cyclone" precursor is §9 Q6.* | `observed` lifecycle + `model-predicted` microphysics (EPIC) |
| 4.4 | **DS2 bright-cored variant** | A smaller dark spot with a persistent **bright central** methane cloud (vs GDS's cleared interior) — dark spots come in cleared-interior and bright-cored variants. | **companion** placed at center (vs offset). | `stormColTerms` companion Gaussian relocated to core. | **IN-#3b** → AC-FIELDS(c) (companion variant) | `observed` (Voyager 2) |
| 4.5 | **The Scooter / fast bright plumes** | Small chevron-shaped bright methane feature racing at a different zonal speed (~16 h circuit); a plume from a deeper deck sheared into a chevron. | A bright **plume**, not a shear-argmax vortex — placement mechanism is different (deep-deck plume + zonal shear). | Would need a small bright streak feature. | **DEFERRED → #5 brown-dwarf** (patchy bright-cloud drift on mask+phase — the plume's natural home). | `observed` (Voyager 2); nature `model-predicted`-uncertain |
| 4.6 | **Warm south-polar region (methane leak)** | Pole ~10 °C warmer than the −200 °C mean; a coherent circumpolar warm zone with stratospheric hot spots (seasonal — sunlit pole leaks methane up). Not a bright *visible* spot per se. | **T/W** (Ward insolation + season). A **thermal** feature. | Would be a subtle polar cap warm tint / emission. | **DEFERRED → #4 emission-v2** (thermal polar warmth is emission). | `observed` (VLT/Keck) |

**Static-end-state note (ice giants):** unlike the gas giants' quasi-permanent ovals, *every* Neptune vortex is one frame of a years-long arc. #3b paints the arc as an **age/phase state** (4.3), never as motion. Latitudes repeat per-seed (frozen constants); phase/longitude/count vary.

---

## 5. URANIAN — near-featurelessness as a designed read

> No current preset (§0.5). Physically = Neptunian-regime + high obliquity (Ward hot-poles inversion, the "Uranus tell" in `climate-e5.js`) + thick haze + **low internal heat** (a frozen constant → the Neptune/Uranus contrast is the derive-not-freeze increment's job).

| # | NAME | VISUAL SIGNATURE | DRIVING FIELD / PHYSICS | RENDER MECHANISM | DISPOSITION | CONF |
|---|---|---|---|---|---|---|
| 5.1 | **Blandness / near-featurelessness** | Near-uniform pale cyan/green disk; bands present in the wind field but almost invisible in albedo; storm mask near-empty. The low-contrast extreme — *boring by design.* | **haze** high (thick Aerosol-2, un-recycled because no internal-heat convection) + near-empty **mask**. The low-internal-heat *driver* is frozen. | Haze veil (§1.2) + empty storm slots. | **IN-#3b as a policy** (paint near-nothing: haze + no storms) → AC-LIVE/AC-UAT read. **The internal-heat driver that separates Uranus from Neptune is DEFERRED → derive-not-freeze variety increment.** §9 Q2. | `observed` (Voyager 2; 2025 energy-balance re-analysis) |
| 5.2 | **Seasonal polar hood / cap** | Bright hazy cap over the sunward pole (currently north, toward 2030 solstice); sharp collar boundary; brightened markedly 2002–2022 as the pole turned sunward. Methane depleted at the poles. | **W** (Ward insolation + obliquity/season) + **haze** thickening at the pole. | `polarVortexCol` **mode 0** cap (bright cap tint) + haze. | **IN-#3b** → AC-LIVE (polar structure), the strongest ice-giant polar feature. | `observed` (20-yr Hubble, James et al. 2023) |
| 5.3 | **2006-type faint dark spot** | Uranus's analogue of Neptune's dark spots — rarer, fainter anticyclone (~1,700×3,000 km) with the same bright companion mechanism. | Same as 4.1 (**shear argmax** + companion), **low amplitude**. | Same slot primitives as Neptune, faint. | **IN-#3b** (ice-giant dark-spot mechanism applies, low amplitude) → AC-LIVE | `observed` (HST 2006) |
| 5.4 | **2014-type convective outbreak cluster** | Rare bright convective storms (Aug 2014: 8 storms; one the brightest ever at 2.2 µm) concentrated in one hemisphere — Uranus erupts sporadically then goes quiet for years. | A rare **outbreak epoch** — a small cluster of bright clouds in one latitude band. | Cluster of small bright slots (outbreak state). | **DEFERRED → derive-not-freeze variety increment** (rare outbreak epoch as a seed-varying state; §9 Q7). | `observed` (Keck/Hubble 2014); trigger unexplained |
| 5.5 | **Neptune-bluer / Uranus-paler palette** | Both blue-cyan; Neptune modestly deeper/bluer, Uranus paler/greener-cyan. Counter-intuitively Uranus has *more* methane — the difference is **aerosol** (thin recycled Aerosol-2 on convective Neptune → blue; thick accumulated haze on stagnant Uranus → pale). **Do not over-saturate Neptune to cartoon indigo.** | **haze** (Aerosol-2 thickness ∝ internal heat / convective vigor — Irwin 2022). | Base albedo/palette + haze mute (#3a). | **Palette IN-#3b** (via haze); the **internal-heat driver of the difference DEFERRED → derive-not-freeze**. | `model-predicted` (Irwin et al. 2022); true-color caveat `observed` |

---

## 6. HOT-JUPITER (tidally-locked) — a different machine; most storms DEFERRED

> **Framing (report 3):** this regime is *not* Jupiter-like. The organizing structure is a **day–night thermal dipole** + **one broad equatorial superrotating jet** — not a stack of sheared bands. #3b's placement mechanism (shear argmax over a banded jet profile) is **physically wrong** here, and the "ink-in-water" band turbulence has *little basis* for the canonical hot/slow case. **Recommendation: #3b hot-Jupiter = banded deck (#3a) + haze only; active-storm phenomena DEFER to #4 emission-v2** (where the day–night thermal map lives). This is the "hot-Jupiter storm policy" ratification call (§9 Q1).

| # | NAME | VISUAL SIGNATURE | DRIVING FIELD / PHYSICS | RENDER MECHANISM | DISPOSITION | CONF |
|---|---|---|---|---|---|---|
| 6.1 | **Equatorial superrotation + eastward hotspot offset** | Single broad prograde equatorial jet (half-width ~1 planetary radius); hottest point shifted **east of substellar by 10–60°**; asymmetric terminators. | Single wide eastward `u(lat)` lobe (#3a) + **T** day–night dipole; hotspot = a **longitudinal phase shift** of the thermal/emission map. A thermal-emission feature. | Emission-map rotation (dayside pattern), not a band feature. | **DEFERRED → #4 emission-v2** (thermal dayside pattern). Jet itself is #3a substrate. | `observed` (offset) + `model-predicted` (jet) |
| 6.2 | **Off-equatorial nightside standing cold gyres** | A symmetric pair of large cyclonic cold vortices flanking the equatorial jet on the nightside — the "two eyes" of the GCM chevron. Phase-locked to substellar geometry, **not** scattered like Jovian storms. | Standing Rossby gyres locked to day–night geometry (2 mirror vortices), **not** shear-argmax placement. | Would be 2 `uStorm` slots, mirror-symmetric, substellar-phase-locked. | **DEFERRED → #4 emission-v2** (the day–night machinery that places them lives there). §9 Q1. | `model-predicted` (robust, near-universal GCM) |
| 6.3 | **GRS-analog free vortex** | A drifting Jovian-style long-lived spot. | Day–night forcing dominates → organizes standing gyres instead; no free drifting spot on tidally-locked hot Jupiters. | — | **DEFERRED / OUT-OF-CLASS** (reserve free single-spot vortices for cooler/faster giants only). | `model-predicted` / `speculative` (no detection) |
| 6.4 | **Cloud patchiness (uniform nightside deck → ultra-hot patchy)** | Cooler HJ: uniform nightside condensate deck, cleared hot dayside. Ultra-hot (>~2200–2500 K): mottled/patchy nightside clouds. | **T**-dependent condensation + day–night transport. | Mask patchiness keyed on T + day–night. | **DEFERRED → #4 emission-v2 / #5 brown-dwarf** (patchy-cloud mask keyed to the thermal map). | `model-predicted` + `observed` indirectly (WASP-43b JWST) |
| 6.5 | **Ultra-hot toggles (magnetic drag)** | Reduced or **reversed (westward)** hotspot offset (WASP-33b), sharpened day–night contrast, dayside molecular dissociation. | Thermal ionization + Lorentz drag on the day–night thermal map. | Emission-map offset sign flip + contrast. | **DEFERRED → #4 emission-v2.** | `observed` (westward cases) + `model-predicted` (mechanism) |
| 6.6 | **Jet-multiplicity regime knob (1 wide → several narrow)** | Canonical hot/slow → one wide equatorial jet; cooler/faster → off-equatorial then multiple jets (approaching Jovian banding). | #3a `rhinesWavenumber` (rotation/irradiation) — **substrate.** *Only at the cool/fast end do the "ink-in-water" shear boundaries become physical.* | #3a jet count; **#3b suppresses band-boundary turbulence for the canonical hot/slow case** (a policy). | **IN-#3b as a suppression policy** (mute filamentation where the single-jet regime makes it unphysical) → AC-VIS(a) (absent where shear low). | `model-predicted` |

---

## 7. SUB-NEPTUNE (hazy) — featureless by design

| # | NAME | VISUAL SIGNATURE | DRIVING FIELD / PHYSICS | RENDER MECHANISM | DISPOSITION | CONF |
|---|---|---|---|---|---|---|
| 7.1 | **Featureless hazy sphere** | Nearly uniform, muted, pale sphere — a high-altitude global aerosol layer masks everything below (GJ 1214b archetype: flat featureless spectrum, reflective, metal-rich). The visual opposite of Jupiter. | **haze** very high (#3a `hazeMute` 0.7) + high metallicity → suppressed contrast; **mask** suppressed; high albedo. | Global haze veil (§1.2), empty storm slots, only very soft large-scale limb/pole shading. | **IN-#3b** → AC-LIVE ("sub-Neptune haze-muted per #3a") | `observed` (HST+JWST, GJ 1214b) |
| 7.2 | **Underlying jets (hidden)** | Jet structure exists (superrotating equatorial jet, high-latitude cyclostrophic jets) but the haze hides all of it. | #3a `u(lat)` muted **to invisibility** by contrast. | #3a bands muted; storm machinery off. | **IN-#3b** (muted to invisibility — a deliberate non-goal to keep visible) → AC-OFFGATE (non-gas-visible presets unchanged) | `model-predicted` (obscured, observationally irrelevant) |

---

## 8. Disposition summary (traceability audit)

**IN-#3b** — each traces to ≥1 AC observable:

| Phenomenon | Regimes | Traces to AC |
|---|---|---|
| Chromophore aging (white→red) | Jovian, ice giants | AC-FIELDS(b), AC-VIS(c) |
| Haze mutes | Saturn, Sub-Neptune, Uranus, Neptune | AC-LIVE, AC-VIS(a), §1.2 |
| Belt/zone turbulent boundaries ("ink in water") | Jovian (+ Saturn muted) | AC-VIS(a), AC-LIVE, AC-UAT |
| Folded filamentary regions | Jovian | AC-VIS(a), AC-LIVE |
| GRS-class anticyclone | Jovian | AC-WRITER(c), AC-LIVE, AC-VIS(b), AC-UAT |
| GRS turbulent wake | Jovian | AC-VIS(b) |
| Vortex streets / storm trains | Jovian | AC-LIVE, AC-WRITER |
| White ovals / Oval-BA aging | Jovian | AC-VIS(c) |
| Brown barges (cyclonic polarity) | Jovian | AC-LIVE, AC-WRITER |
| Mushball convective mask texture | Jovian | AC-FIELDS(a) |
| Polar cyclone clusters (lattice) | Jovian, Saturn(S), Uranus | AC-LIVE, AC-PARITY |
| Saturn hexagon (polygon mode) | Saturnian | AC-LIVE |
| S-polar cyclone / eyewall | Saturnian | AC-LIVE |
| Ice-giant dark spot | Neptune, Uranus | AC-LIVE, AC-WRITER |
| CH₄ bright companion (+ DS2 variant) | ice giants only | AC-FIELDS(c), AC-LIVE |
| Dark-spot lifecycle age/phase | ice giants | AC-FIELDS(b), AC-WRITER |
| Uranus near-featurelessness (policy) | Uranian | AC-LIVE, AC-UAT |
| Uranus seasonal polar hood | Uranian | AC-LIVE |
| Uranus faint (2006-type) dark spot | Uranian | AC-LIVE |
| Neptune/Uranus palette (via haze) | ice giants | AC-LIVE |
| Hot-Jupiter band-turbulence suppression | hot-Jupiter | AC-VIS(a) |
| Sub-Neptune featureless veil / hidden jets | Sub-Neptune | AC-LIVE, AC-OFFGATE |
| Per-vortex seeded phase bank | all giants | AC-FIELDS(d) |

**DEFERRED** — each names its target increment:

| Phenomenon | → Increment | Why deferred |
|---|---|---|
| Festoons + 5-µm hot spots | **#4 emission-v2** | thermal windows = emission; needs azimuthal-wave term |
| Shallow lightning (mushball) | **#4 emission-v2** | Poisson on the mask (the mask's named DAG consumer) |
| Neptune warm south-polar region | **#4 emission-v2** | thermal, not albedo |
| Hot-Jupiter eastward hotspot offset | **#4 emission-v2** | day–night thermal map |
| Hot-Jupiter nightside cold gyres | **#4 emission-v2** | day–night-locked placement (not shear argmax) |
| Hot-Jupiter ultra-hot toggles | **#4 emission-v2** | magnetic-drag on thermal map |
| Hot-Jupiter cloud patchiness | **#4 emission-v2 / #5 brown-dwarf** | T-keyed patchy mask |
| Hot-Jupiter GRS-analog free vortex | **OUT-OF-CLASS** | physically absent on tidally-locked HJ |
| The Scooter / fast bright plumes | **#5 brown-dwarf** | patchy bright-cloud drift, not a vortex |
| Belt fades / NEB expansion | **derive-not-freeze variety** | epoch band-contrast state |
| Saturn Great White Spot outbreak | **derive-not-freeze variety** | outbreak epoch state |
| Uranus 2014-type outbreak cluster | **derive-not-freeze variety** | rare outbreak epoch state |
| Neptune-vs-Uranus internal-heat difference | **derive-not-freeze variety** | the frozen `internalHeat`/`dissipation`/`shellDepthFrac` |

---

## 9. Open questions for Max's ratification

*(These are the genuine taste/scope calls — where physics + the static-engine discipline leave a real decision. Each carries my recommendation and its reasoning; ratify, or redirect.)*

**Q1 — Hot-Jupiter storm policy.** Hot Jupiters are a different machine (day–night thermal dipole + one wide equatorial jet), and #3b's placement mechanism is shear-argmax over a *banded* profile — physically wrong for tidally-locked worlds. **Recommendation:** #3b hot-Jupiter renders as a banded deck (#3a) + haze only, with band-boundary turbulence *suppressed* for the canonical hot/slow case (6.6); all active hot-Jupiter phenomena (hotspot offset, nightside gyres, patchiness, ultra-hot toggles) DEFER to #4 emission-v2, where the day–night thermal map lives. Confirm this is the intended line — or do you want a placeholder gyre pair in #3b?

**Q2 — Uranus near-featurelessness as a feature.** Physically Uranus is *supposed* to look near-empty: pale, hazed, storm-poor. **Recommendation:** paint it that way deliberately (haze veil + near-empty slots + seasonal polar hood), accepting a "boring" read as correct, and route the low-internal-heat driver that separates Uranus from Neptune to the derive-not-freeze increment. Two sub-calls: (a) is a deliberately bland planet an acceptable per-minute outcome, or does it undercut "distinct worlds/minute"? (b) does #3b add a **distinct Uranian preset**, or realize Uranus as a Neptunian-regime variant (high obliquity + high haze)? (Currently there is *no* Uranian preset.)

**Q3 — Juno polar-cluster geometry literalness.** The lattice mode can render an exact N-fold polygon of cyclones (Jupiter ~8 north / ~5→6 south) or a looser cluster. **Recommendation:** fixed canonical N per regime as a *declared constant* (Jupiter lattice ~8, Saturn hexagon N=6), GUI-tunable, not derived from a stability calculation. How literal do you want the Juno octagon/pentagon — exact counts, or "a ring of several, count unimportant"?

**Q4 + Q7 — Confirm two deferrals (one nod covers both; largely pre-settled by the contract).** (Q4) Festoons / 5-µm hot spots are cloud-clearing thermal windows in an azimuthal Rossby-wave chain — an emission feature needing an azimuthal-wave mask term → **DEFER to #4 emission-v2** (the required family "barges/festoons/hot-spots" is covered by barges IN + festoons/hot-spots deferred). (Q7) Outbreak/epoch states — Saturn's Great White Spot, Uranus's 2014 cluster, Jupiter's belt fades — are rare epoch states → **route to the derive-not-freeze variety increment** as seed-varying epoch toggles (contract designDecision 3 already implies this); #3b paints no outbreak state.

**Q5 — GRS wake: dedicated term or emergent?** AC-VIS(b) wants "wake detail." **Recommendation:** build a dedicated upstream-turbulence cone anchored to the primary vortex (the GRS wake is the planet's most turbulent patch and reads as a signature). Alternative: accept the `stormSwirl` interior spiral as "enough" and skip a bespoke wake term. Which — bespoke wake term, or swirl-only?

**Q6 — Dark-spot lifecycle: how many phases?** Ice-giant spots are snapshots of a birth→drift→death arc. **Recommendation:** expose three age/phase states (precursor = companion-only-no-core / mature = dark-core+cap / dissipating = weak-contrast-near-equator). Sub-call: is the "invisible cyclone" precursor (bright companion, no dark spot) worth painting, or start at "mature"?

**Q8 — Cyclonic-vs-anticyclonic band-turbulence character.** FFR chaos lives on the *cyclonic* (poleward-of-prograde-jet) side; the anticyclonic side stays cleaner. **Recommendation:** build the sign-of-shear character split in #3b (it's the same `jetShear` field, just its sign), because symmetric turbulence would miss the FFR read. Alternative: ship symmetric filamentation in #3b, defer the asymmetry. Which — asymmetric now, or symmetric-first?

---

## 10. Caveats on record (disclosures, not decisions)

- **Chromophore identity.** The white→red ramp is grounded in the "possibly universal chromophore" model, but the chromophore's *chemical identity* (NH₃+C₂H₂ photoproduct vs NH₄SH) is scientifically unresolved. The ramp ships as a phenomenological color mapping (age→hue), not a chemistry claim — no code depends on the identity.

## 11. Build-time verification flags (from the Slice-R adversarial audit — resolve at BUILD-PLAN, none block ratification)

1. **§4.4 DS2 centered companion:** verify `spotCompanion` carries a settable centered-vs-offset placement without a new param (`uStormParams` vec4 is fully allocated).
2. **§3.2 pole-asymmetric polar:** confirm one `polarVortexCol`/`uPolar` pass can render mode 1 (N hexagon) + mode 0 (S cap) on the same planet without a second mode uniform.
3. **§2.1 `bandWarpField`:** confirm the named primitive exists (grounding names `zonalBandCol`) or restate the filamentation term as new in-envelope GLSL.
4. **§2.10 `uPolarRing`:** confirm it is an existing uniform slot, not a new one that would breach the one-new-attribute envelope.

---

*Prepared for ratification. On sign-off, record the date + Max's verdict in the header block; slices P (physics writer) and V (render complexity) then build against this doc.*
