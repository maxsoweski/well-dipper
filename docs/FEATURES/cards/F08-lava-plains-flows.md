# Feature Card — F08 Lava plains & flows
Domain: Relief · Lab status: ✅ · Build-seq phase: 3

## 1. Description (WHAT)

F8 "Lava plains & flows" (F-relief family, close-up/LOD2 tier) derives from P4 effusive volcanism: low-viscosity magma floods and flattens older terrain into plains, building flood basalts, leveed channels, lava tubes — resetting local surface age over Myr timescales, from a single flow up to million-km² flood-basalt provinces. P4's L0 drivers: D12 tidal heating (eccentricity-driven interior heat — the Io engine), D14 mass/gravity (low-g → giant shield-scale features), D5 pressure, and D11 surface-history (the resurfacing budget — high resurfacing ⇒ few craters + broad plains, so F8 and F2 craters are two faces of one number). Variants: flood-basalt plain · leveed channel · sinuous rille · collapsed tube / pit chain. Real-body examples: lunar maria (with their wrinkle ridges — mare compression ridges, deferred from F5 into F8 here), Venusian canali (Baltis Vallis, ~6800–7400 km, the longest channel known), and Io's active flow fields (Amirani–Maui, the longest active flow in the solar system). Applicable WD types: rocky, lava, venus, terrestrial, ice, machine; for the lava archetype it is a headline feature ("F8 F41 + emissive cracks"). Doc status was `[partial]` (lava-type cracks) at inventory time; the lab build has since landed the full plains + wrinkle + emissive-crack stack.

## 2. Current shader approach (HOW, as-built)

BUILT (Stage-C step 3, Relief). Three pieces in /home/ax/projects/well-dipper/world-engine-lab.html: (1) `lavaCombiner` (:1099–1119) — a low-frequency `noised()` FBM thresholded into a flow-region mask whose extent grows with `uLavaCoverage` (1.0 ⇒ whole-world Io-grade resurfacing); inside the region it SMOOTHS — `h *= (1−region); grad *= (1−region)` — flooding/flattening all accumulated relief (it runs LAST in the combiner chain, :1513, so it suppresses mountains/craters/edifices), then lays wrinkle ridges on the fresh plain via `ridgeWave` on a domain-warped directional field along seeded `uLavaAxis` (reusing F6 tessera / F5 scarp patterns, exact analytic gradient). (2) `lavaCrackEmissive` (:1129–1142) — Worley F2−F1 (`voronoi3d`) crack mask confined to the same region mask, pulsing `sin(uTime*uLavaGlowRate + fbm*2π)` with spatially-varying phase, colored by `emissiveBlackbody(1400.0)` and gated by `uLavaActivity`; it ALWAYS bypasses the posterizer through the ★ emissive channel (:1579–1581) — the canonical Option-C survivor. (3) Uniforms declared :248–259, initialized :1688–1699; state defaults :1939–1951; frame-loop state→uniform :2221–2226; GUI folder `fLava` under Surface — Relief (:2398–2415) with coverage/activity `.listen()`-synced and scale/wrinkle/crack/glow as lab knobs + 🎲 randomize (`uLavaOffset`). Drivers derived in /home/ax/projects/well-dipper/planet-lod-lab-core.js `deriveUniforms`: `lavaCoverage = clamp01(resurfacing)` from D11 surfaceHistory (:739–745), `lavaActivity = tidalProxy` from the Io-normalized D12 tidal-heat clamp (:747–751, physics at :519–530), `lavaAxis = seededUnitVec3(seed+12)` (:763), plus a `channelDensity` field (:754–758) surfaced for the deferred sinuous-rille combiner (no GLSL consumer yet). Registry: /home/ax/projects/well-dipper/planet-archetypes.js:15 `FEATURES.lava` (enableKey `lavaEnabled`, archetype `volcanic`); :29 maps the volcanic archetype to preset 'Lava (hot airless)'.

## 3. Reference images (real + art)

- [real] https://photojournal.jpl.nasa.gov/catalog/PIA02585
  — Amirani flow field on Io (Galileo): a lava plain as a patchwork of overlapping dark lobes with sharp bright/dark margins — the flow-region boundary is a crisp, low-frequency edge, not a gradient.
- [real] https://science.nasa.gov/photojournal/lava-flows-and-ridged-plains-at-prometheus-io/
  — Prometheus flows over ridged plains: dark fresh flows superposed on a regularly-spaced parallel ridge fabric — exactly the plains+wrinkle two-layer reading the combiner builds.
- [real] https://science.nasa.gov/resource/wrinkle-ridge-in-mare-crisium/
  — Lunar mare wrinkle ridge: long, low, sinuous, one dominant strike direction, visible mostly through grazing-light shading — pure normal-channel detail, ideal for the posterized envelope.
- [real] https://en.wikipedia.org/wiki/Baltis_Vallis
  — Baltis Vallis, Venus: a ~6800 km single-conduit sinuous canali — the form target for the deferred channelDensity-gated rille combiner (thin, river-like, constant width).
- [real] https://www.hou.usra.edu/meetings/lpsc2025/pdf/1146.pdf
  — LPSC analysis of Baltis Vallis morphology: channel floor sits 20–100 m below surrounding plains with sparse levees — a rille is a shallow incision, not a raised ridge.
- [art] https://www.patreon.com/posts/stylized-lava-32245619
  — Minions Art stylized lava: smoothstep-isolated brightest cracks with edge-multiplied glow — bright network over dark crust, the same crackMask*glow grammar at higher saturation than our 1400 K target.
- [art] https://godotshaders.com/shader/stylized-lava/
  — Godot stylized-lava shader: Voronoi cell crust with emissive interstitial seams — confirms the F2−F1 polygonal-plate read holds with very few tonal levels.
- [art] https://itch.io/game-assets/tag-lava/tag-pixel-art
  — Pixel-art lava tile sets: limited-palette lava reads as 2–3 dark crust tones plus one saturated emissive accent — calibration for how little color the 6-level envelope actually needs.

## 4. Math / modeling notes (HOW, from the field)

Geomorphology models effusive emplacement through flow rheology: flood basalts are low-viscosity, high-effusion-rate sheets that pond and inflate, burying prior relief (the "resets local surface age" axis the inventory pins to D11); channels/rilles are modeled as thermo-mechanical erosion by sustained low-viscosity flow (Baltis Vallis floors sit 20–100 m below the plain, near-leveeless — erosional, possibly carbonatite-grade viscosity), and wrinkle ridges as post-solidification compressional tectonics of the cooled load. Procedurally, the field reduces this to mask-then-modify: a low-frequency region mask decides WHERE flooding happened, relief inside the mask is attenuated toward a datum (the as-built `h*=(1−region)` is exactly this), and fresh-surface texture is layered on top. The research doc (research/RESEARCH_high-lod-planet-shaders-2026-06-05.md) supplies the vocabulary already in use: analytic-derivative `noised()` FBM for the region mask with exact gradients; "Worley F2−F1 cracks + emissive pulse" called out as the single best posterization-survivor in the fluid domain ("add the emissive AFTER the 6-level posterize" — the Option-C hybrid bypass, §3.3/§2); domain-warped FBM listed as the lava-type combiner dispatch; "flow-map two-phase advection" with lava flow direction = −grad(height) as the universal moving-fluid primitive; and nimitz-style "animated-fbm lava churn" with a black-body emissive ramp for crustless molten lakes (more F41's territory than F8's). Most promising next shader step: consume the already-derived `channelDensity` (planet-lod-lab-core.js:754–758) with a sinuous-rille combiner — a warped directional polyline carve in the F4-canyon/F8-wrinkle pattern (axis swapped global→local-flow, incising 20–100 m-scale below the plain datum) — and optionally advect the crack glow along −grad(h) with two-phase flow maps so active worlds' cracks visibly creep. Both route detail through normals + the emissive bypass, so they survive the 4×4 Bayer + 6-level posterize unchanged.

## 5. Isolation recipe (:9223)

Built — solo it in the :9223 debug Chrome (launch per memory/chrome-devtools-9223-launch.md; use chrome-devtools MCP, not Playwright). 1) Navigate to world-engine-lab.html. 2) `window._lab.setPreset('Lava (hot airless)')` — the volcanic-archetype preset (planet-archetypes.js:29; defined world-engine-lab.html:2151): resurfacingRate 0.95 ⇒ lavaCoverage≈0.95, e=0.15 at 938 R⊕ ⇒ strong tidalProxy ⇒ glowing cracks. 3) `window._lab.solo('lava')` — 'lava' is the real FEATURES key (planet-archetypes.js:15); this flips every other enableKey off. 4) Distances via `window._lab.state.distance` (clamped 1.1–30): 8 for the global maria-patch read, 3 for the flow-region boundary + wrinkle-ridge strike, 1.4 for crack-network close-up under LOD2. 5) Rotate to the night side (drag yaw) — the emissive cracks are Lambert-independent and must stay visible and pulsing there. 6) Behavior sweeps in the GUI folder Surface — Relief → 'Lava plains (F8)': drag 'activity (crack glow)' to 0 (plains persist, glow dies — old solidified world), drag 'coverage (smooths)' 0→1 (no plains → whole-world resurfacing), 🎲 randomize for fresh domain offsets. Verify states via `window._lab.featureEnabled('lava')` / `window._lab.state.lavaCoverage`, then `window._lab.enableAllFeatures()` to clear the solo.

## 6. What to judge (UAT checklist)

- [ ] Does the flooded region read as a smooth dark PLAIN that visibly erases craters/mountains/edifices inside a coherent low-frequency boundary — i.e., does flooding read as burial/age-reset, not as a painted patch — in the 6-level posterized envelope?
- [ ] Do wrinkle ridges read as long, low, sinuous parallel ridges with ONE dominant strike direction, confined to the plain, expressed through shading (normal channel) rather than albedo — and never as isotropic noise?
- [ ] Does the emissive crack network read as connected polygonal seams between crust plates (Worley-border form), confined to the lava plains and absent from the highlands?
- [ ] Does the crack glow stay crisp and unbanded over the posterized basalt (emissive-bypass behavior), remain visible on the night side, and pulse asynchronously across the network rather than blinking in unison?
- [ ] Does the coverage axis behave physically: 0 ⇒ untouched old relief, mid ⇒ maria-like patches, 1 ⇒ Io-grade whole-world fresh plain — with crater suppression and plain extent moving together (shared D11)?
- [ ] Does the activity axis behave physically: 0 ⇒ dark solidified plains whose FORM persists (cold dead world), high ⇒ glowing cracks — reading as the tidal-heat dial, independent of coverage?
- [ ] Does the molten color read as fresh-basalt incandescence (~1400 K orange-white from the blackbody ramp) rather than saturated cartoon red, and does it sit harmoniously over the Bayer dither at all three judging distances?
- [ ] Approaching from distance 8 → 1.4, does the crack network gain definition continuously without shimmer, aliasing, or popping against the 4×4 Bayer pattern?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: 🟡 2026-06-10 — Lava (hot airless), solo `lava`, d8/d6/d4/d1.4,
  day + night side. **Live Max UAT feedback mid-pass** (see below) → one
  fix cycle applied, awaiting his re-look.
  - Plains/burial 🟢: flooded regions read as smooth plains erasing
    craters/mountains inside a crisp low-frequency lobate boundary at
    coverage 0.45 with F1/F2 re-enabled (shot 02) — burial, not paint.
  - Coverage axis 🟢: 0.45 maria patches → 0.95 whole-world Io plain
    (shots 01, 02); crater suppression and plain extent move together.
  - Activity axis 🟢: activity 0 kills the glow, plains' form persists
    on the night side (shot 05 vs 04).
  - Glow behavior 🟢: emissive bypass keeps channels crisp over the
    posterized basalt; visible on the night side; pulses (5.9% of frame
    changed over 1.5 s, mean changed-pixel color 141/107/81 R>G>B —
    incandescent, not cartoon red).
- Max's feedback (2026-06-10, live): "the lava flows look the least
  realistic… what would lava flows look like from space? Mostly like
  water but a different material. The glow and everything looks cool but
  the cell-based shape of the flows is all off." → should not pass
  visual QA as-was.
- Tweaks applied (fix cycle 1, root-caused first): the cell read came
  from `lavaCrackEmissive`'s UNWARPED Worley F2−F1 border lattice tiling
  the whole flooded region (at Io coverage 0.95 = the entire globe);
  topology is structural to F2−F1, not slider-reachable. Edit confined
  to that one function (emissive-only, no relief/gradient math, vitest
  untouched 8/8 green): (1) strong 3-axis FBM domain-warp of the crack
  field — borders now meander/branch like channels and levees; (2) glow
  clustered into volcanic provinces via a low-freq mask scaling with
  activity — Io reads as scattered centers, not a globe-tiling net;
  (3) flow-front term (region-edge band) so advancing lobate margins
  glow. Result: night side = meandering channel networks in provinces
  with dark quiet zones (shot 07 vs old 04); day side = smooth liquid
  sheets with lobate margins (shot 08). Warped-cell borders now read as
  dark lobes with bright margins — the Amirani signature.
- Re-verify: shots 07/08 retaken post-fix on reloaded page; vitest 8/8.
  Cycle-2 knobs if Max wants more: lower uCrackScale (fewer, bigger
  lobes), CRACK_WARP_AMP (currently 0.38), province thresholds.
- Status: VERIFIED_PENDING_MAX (fix cycle 1 of 3 used; Max re-look
  requested)
- Shots: F08-lava-01-d8-io.png, -02-d6-maria-burial.png,
  -03-d1.4-cracks.png, -04-d4-nightside.png (pre-fix),
  -05-d4-nightside-activity0.png, -06-d3-wrinkles.png,
  -07-d4-nightside-fix1.png, -08-d4-dayside-fix1.png.
