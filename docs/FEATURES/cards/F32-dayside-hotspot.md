# Feature Card — F32 Dayside thermal hotspot
Domain: Thermal · Lab status: 🟡 · Build-seq phase: 4b

## 1. Description (WHAT)

Dayside thermal hotspot — irradiation-driven self-emission on tidally-locked hot worlds (WD type: hot-jupiter only; sibling F33 owns the nightside floor). Physical chain (L0→L1): D7 tidal-lock state pins one hemisphere at the star; D1 equilibrium-temperature contrast plus D5/D8 (atmosphere density, rotation) drive P21 tidally-locked circulation — permanent day/night hemispheres with substellar standing convection and a superrotating equatorial jet that drags the thermal maximum EAST of the substellar point. Visible result: the dayside glows with its own heat, brightest in a broad cap near (but offset from) the substellar point, fading through the terminator. Variants (inventory F32 row, planet-visual-features.md:292): warm dayside (mild contrast, HD 189733 b-class) · glowing molten-bright dayside (ultra-hot, charcoal-glow regime) · eastward-shifted hotspot (superrotation; measured offsets ~7.75° on WASP-43 b to ~30° on HD 189733 b). Real-body examples: HD 209458 b, WASP-43 b. Inventory status: `[current]` (day-side thermal) — that tag refers to the legacy production shader, not the lab; campaign tracker has F32 at 🟡 partial, Phase 4b.

## 2. Current shader approach (HOW, as-built)

Unbuilt in planet-lod-lab.html as a feature combiner (no FEATURES key in planet-archetypes.js, no hot-jupiter archetype, no uThermalStrength uniform) — but three pieces of machinery already exist for it. (1) Canonical shared varying vSubstellarAngle (planet-lod-lab.html:133-143): acos(dot(normalize(position), normalize(uLightDir))), 0 at substellar → π at antistellar, explicitly documented as serving "Bands (thermal)". (2) emissiveBlackbody(tempK) (planet-lod-lab.html:522-538): a stylized Planckian-locus chromaticity ramp (800 K deep red → 6500 K white) whose header names "BANDS thermal (F32/F33)" as a designated consumer, with brightness to be scaled by "uThermalStrength × starFacing" (that uniform does not exist yet). (3) The emissive-bypass channel (planet-lod-lab.html:1572-1581): the posterize(surface)+emissive composite split where F32 is listed as an owner; the current stand-in is a whole-globe `uBaseColor * uEmissive` glow commented "lava/hot stand-in for F41/F32" — uniform over the sphere, not substellar-shaped. The inventory's `[current]` tag points at the LEGACY production shader src/objects/Planet.js:310-318 (planetType 6): starFacing = max(dot(normalize(vWorldPos), lightDir), 0.0); hotspot = pow(starFacing, 3.0); surfaceColor += accentColor * hotspot * 0.8, plus a faint deep-red nightside term and a light-independent emissive continuation (~:361+). That legacy version is centered exactly on the substellar point — no eastward superrotation offset and no blackbody chromaticity.

## 3. Reference images (real + art)

- [real] https://esawebb.org/images/WASP43b-2/
  — JWST MIRI phase-curve temperature map of WASP-43 b — the canonical data reference: one broad hot cap (~1250 °C) shifted slightly east of the substellar point, smooth monotonic falloff to a ~600 °C nightside; note the hotspot is a soft ellipse, not a point.
- [real] https://www.spitzer.caltech.edu/image/ssc2007-09a1-first-map-of-an-exoplanet-atmosphere
  — Spitzer's first exoplanet brightness map (HD 189733 b) — the hotspot offset ~30° east of the substellar point with only ~240 K day-night contrast; the 'warm dayside' variant where the glow gradient is shallow and wraps well past the terminator.
- [real] https://arxiv.org/pdf/2404.16488
  — 2D eclipse mapping of WASP-43 b (JWST MIRI/LRS) — quantifies the meridionally-averaged eastward hotspot shift at 7.75°±0.36°; shows latitude structure: hottest along the equator, cooling toward the poles, the 2-axis falloff our temperature field should reproduce.
- [real] https://science.nasa.gov/resource/spitzer-maps-an-exoplanet/
  — NASA Science page for the HD 189733 b map — clean statement of the mechanism (supersonic eastward winds advect the heated air) that justifies rotating the thermal cap off the light direction.
- [art] https://www.jpl.nasa.gov/images/pia21074-clouds-on-hot-jupiters-illustration/
  — NASA/JPL 'Clouds on Hot Jupiters' illustration — stylized phase sequence showing the evening-side charcoal glow and how dayside incandescence reads against a darker cloud-banded hemisphere; good color-temperature reference for the molten-bright variant.
- [art] https://www.artstation.com/artwork/kRrvK
  — Exo One 'Tidally Locked World — Hot Side' game environment (Jay Weston) — how a shipped stylized game sells permanent-dayside heat with emissive materials and a restrained warm palette; emission carries the read, not texture detail.
- [art] https://photojournal.jpl.nasa.gov/catalog/PIA09200
  — NASA photojournal PIA09200 'Exotic Atmospheres' artist concept — a row of hot-Jupiter renderings at varying irradiation; useful for calibrating how much of the limb the glow should claim at each temperature tier.

## 4. Math / modeling notes (HOW, from the field)

Academia models this with 3D general-circulation models (GCMs): Showman & Guillot (2002) predicted a superrotating equatorial jet on hot Jupiters that advects the thermal maximum eastward of the substellar point, confirmed observationally by the Spitzer HD 189733 b map (~30° offset) and the JWST WASP-43 b eclipse map (7.75°±0.36°). The lightweight analytic form the exoplanet community uses for phase curves is an energy-balance kernel: brightness temperature T(λ,φ) ≈ T_night + (T_day − T_night)·max(cos(λ−Δλ)·cos(φ), 0)^n, where Δλ is the hotspot offset and a redistribution efficiency ε sets the day-night contrast (ε→1 even temperatures, ε→0 hard contrast); emitted color then follows the Planck blackbody function of that local T. Games skip the GCM entirely — the production Planet.js already uses the degenerate case: hotspot = pow(starFacing, 3) with Δλ = 0 and a fixed glow color. The lab's vocabulary maps cleanly: this is an emissive-bypass-channel term (Option C of the envelope decision — "add the emissive AFTER posterization so the glow doesn't get banded"), consuming the canonical vSubstellarAngle varying and the shared emissiveBlackbody ramp, with brightness uThermalStrength × starFacing per the ramp's own header, driven by D1/D7 through the driver-bundle preset (no shader branches). Most promising shader-side approach: rotate uLightDir by a uHotspotOffsetRad about the planet's spin axis on the CPU to get a "thermal direction" uniform, compute shiftedFacing = dot(N, thermalDir), then tempK = mix(uNightTempK, uDayTempK, pow(max(shiftedFacing,0), uRedistribution)) and add emissiveBlackbody(tempK) × uThermalStrength × smooth facing falloff into the post-posterize emissive channel. That one expression yields all three variants (offset=0 + low contrast = warm dayside; high T_day = molten-bright; offset>0 = superrotation) and shares its tempK plumbing with F33's nightside floor for free.

## 5. Isolation recipe (:9223)

Unbuilt — recommended recipe once built. Register in planet-archetypes.js FEATURES as `daysideThermal` ({ label: 'Dayside thermal (F32)', enableKey: 'daysideThermalEnabled', archetypes: ['hot-jupiter'] }) alongside a new 'hot-jupiter' ARCHETYPES entry with a 'Hot Jupiter' DRIVER_PRESETS bundle (T_eq ≈ 1400 K, tidalState { locked: true, lockType: 'synchronous' }, h2-he atmosphere). Then on the :9223 lab page: (1) window._lab.setPreset('Hot Jupiter') — until that preset exists, 'Lava (hot airless)' is the nearest stand-in (T_eq 950, locked synchronous, planet-lod-lab.html:2151); (2) window._lab.solo('daysideThermal'); (3) window._lab.state.distance = 20 for the global day/night read, then 8 and 3 to confirm the glow stays unbanded (bypass channel) at close LOD; (4) drag yaw to put the terminator mid-screen — the eastward offset should make one limb glow past the terminator and the other go dark before it; (5) sanity-check inputs with the existing debug modes (GUI 'voronoi / bb / sub debug', planet-lod-lab.html:2120): mode 6 = substellar-angle field, mode 5 = blackbody ramp.

## 6. What to judge (UAT checklist)

- [ ] Does the hotspot read as a single broad glowing cap near the substellar point — a soft ellipse like the WASP-43 b map, not a full-hemisphere wash and not a pinpoint — in the 6-level posterized envelope?
- [ ] Does the eastward superrotation offset read as terminator asymmetry: glow bleeding past one terminator and dying before the other, rather than a symmetric day/night split?
- [ ] Does the emissive glow stay smooth and unbanded against the posterized band surface (bypass channel working), with no Mach-band rings from the quantizer between the hot cap and the nightside?
- [ ] Does the blackbody chromaticity read as a hot-to-cool form — white/amber core stepping through orange to deep dull red at the fringe — with roughly 3-4 discernible color zones, never a flat single-color tint?
- [ ] Does the glow stay locked to the star direction as the planet spins and the camera orbits (tidally-locked behavior — fixed to lightDir, not rotating with the surface)?
- [ ] Do the variants separate at the driver level: warm-dayside preset reads as a gentle wraparound warmth, molten-bright preset reads as charcoal-glow incandescence that dominates the lit hemisphere?
- [ ] Does it compose with the F33 nightside floor as one monotonic thermal gradient — hottest east-of-substellar, dimmest at the antistellar point — with no dead seam at the terminator?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
