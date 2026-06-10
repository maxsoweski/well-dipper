# Feature Card — F41 Hemispheric magma ocean
Domain: Exotic · Lab status: ⬜ · Build-seq phase: 4c

## 1. Description (WHAT)

Hemispheric magma ocean (domain: Exotic, F-exotic-natural group, status [aspirational], confidence *speculative*). Physical chain from the L0/L1 rows: extreme equilibrium temperature (D1, the master gate for volatile state) on a tidally locked body (D7: permanent day/night hemispheres → "eyeball climate, substellar magma, terminator rings") keeps the permanent dayside above the silicate solidus, forming a molten sea; effusive volcanism (P4: low-viscosity magma, lava plains/flood basalts) and tidal-heat resurfacing (P6: heat-pipe volcanism continuously repaves, zero-age surface) keep it molten and crater-free. Variants per the F41 row: molten dayside sea · magma shoreline/waves at the terminator · nightside rock-frost condensate plains (rock-vapor winds blow to the frigid nightside and condense as rock rain/snow). Real-body examples: K2-141b and 55 Cancri e (both candidates — dayside ~3000 K vs nightside ~−200 C on K2-141b). WD types: lava (F8 + F41 + emissive cracks at extreme T_eq or high tidal heat) and eyeball (F41 as the hot lobe, alongside F22 terminator ring and F48 nightside cities).

## 2. Current shader approach (HOW, as-built)

Unbuilt (aspirational). No `magma`/F41 key exists in the FEATURES registry of /home/ax/projects/well-dipper/planet-archetypes.js (only F8 `lava`, line 15) and no magma-ocean combiner exists in planet-lod-lab.html — but the lab already reserves F41's seat in three places: (1) the shared incandescence ramp `emissiveBlackbody(tempK)` at planet-lod-lab.html:522-537, whose header comment names "ONE curve, two consumers: BANDS thermal (F32/F33) + EXOTIC magma (F41)" — a stylized Planckian-locus chromaticity ramp from 800 K deep red to 6500 K white; (2) the post-posterize emissive bypass channel at :1571-1581, whose owners list includes "magma Exotic F41 (emissiveBlackbody)" and where `uEmissive` (:1611) currently acts as a whole-surface "lava/hot stand-in for F41/F32"; (3) the hemispheric field it needs — the `vSubstellarAngle` varying (vertex shader :134-139, 0 at substellar → π at antistellar, computed once from `uLightDir`) already drives the frost eyeball antistellar cap via `uFrostLocked` (:290, :1383-1387) and is exposed as debug mode 6 (:1455). Adjacent machinery to reuse: `lavaCombiner` (:1099, SMOOTH — floods and flattens older relief inside a region) and `lavaCrackEmissive` (:1129, Worley crack-mask glow gated by `uLavaActivity`). The 'Lava (hot airless)' driver preset (:2151) already carries the right physics: T_eq 950, tidalState locked/synchronous, resurfacingRate 0.95.

## 3. Reference images (real + art)

- [real] https://science.nasa.gov/missions/webb/nasas-webb-hints-at-possible-atmosphere-surrounding-rocky-exoplanet/
  — NASA Webb on 55 Cancri e — the canonical candidate: tidally locked, dayside ~2800 F, surface 'a bubbling ocean of magma' that outgasses a thin CO/CO2 atmosphere; note the global hot-lobe framing, not point volcanoes.
- [real] https://en.wikipedia.org/wiki/K2-141b
  — K2-141b parameters — the magma ocean covers a large fraction of the dayside only; the shoreline is a temperature contour, which is exactly the substellar-angle threshold our shader should draw.
- [real] https://earthsky.org/space/k2-141b-lava-planet-with-magma-ocean-rocky-rain-supersonic-winds-super-earth/
  — K2-141b explainer with the McGill illustration — three-zone anatomy to copy: glowing molten center, crusting shoreline ring, dark nightside with rock-snow condensate flowing back.
- [real] https://news.mit.edu/2016/temperature-map-super-earth-lava-world-0330
  — Spitzer temperature map of 55 Cnc e (real data, not art) — huge day/night thermal contrast and an offset hot spot; the brightness asymmetry is the whole feature at full-disc distance.
- [real] https://www.nasa.gov/missions/juno/nasas-juno-gives-aerial-views-of-mountain-lava-lake-on-io/
  — Juno's Loki Patera lava lake on Io — magma 'smooth as glass' with a hot glowing rim and dark crusted islands: the close-up texture grammar for the magma sea and its shoreline plates.
- [art] https://louisecrouch.artstation.com/projects/wJyBwX
  — Stylised lava-planet shader (ArtStation) — flat-shaded crust plates over a bright emissive fluid; shows how few tones a readable lava world actually needs, close to our 6-level budget.
- [art] https://www.shadertoy.com/view/ldBfDR
  — 'Lava Planet' by p_malin (Shadertoy shader-of-the-week) — procedural full-disc lava body; note how emissive crack networks against dark crust carry the read at planet scale.
- [art] https://godotshaders.com/shader/lava-shader/
  — Godot nimitz-style lava churn — time-rotated octave FBM giving a roiling molten-lake motion without flow buffers; the churn behavior target for the open sea interior.

## 4. Math / modeling notes (HOW, from the field)

Academia models lava worlds as radiative-equilibrium hemispheres on tidally locked rockies: dayside surface temperature falls off as T(θ) ≈ T_substellar · cos^(1/4)θ with substellar angle θ, and the magma-ocean shoreline is simply the contour where T crosses the silicate solidus (~1400-1700 K) — so the entire planet-scale form is one scalar field plus a threshold. Recent work adds dynamics: magma-ocean wave/thermal-variability models (arXiv 2601.07080) and nightside condensate-return circulation (rock-vapor winds → rock snow → sluggish return flow), which justify a churning, slightly time-varying sea and bright nightside frost plains. Games almost always fake this with a static emissive texture; the better procedural path uses exactly the vocabulary of research/RESEARCH_high-lod-planet-shaders-2026-06-05.md: domain-warped FBM for the lava/exotic swirl ("the authored continents effect"), Worley F2−F1 cracks + emissive pulse (the doc's lead lava recommendation — "best posterization survival of any fluid effect"), flow-map two-phase advection as the universal "flow without buffers" primitive, nimitz-style animated-fbm churn for the roiling open sea, and the Option-C hybrid envelope: add the emissive AFTER the 6-level posterize so the glow doesn't get banded. Most promising shader-side approach: derive a temperature field tempK = mix(T_night, T_sub, pow(max(cos(vSubstellarAngle),0),0.25)) from the existing substellar varying, threshold it into three zones — molten sea (relief SMOOTHED like lavaCombiner, domain-warp-churned brightness feeding the shared emissiveBlackbody(tempK) ramp through the existing emissive bypass channel), a shoreline band (reuse lavaCrackEmissive's Worley crack-plate mask as crusting rafts whose glow fades with distance from the terminator-side solidus contour), and a dark nightside that re-enters the posterized surface path with an antistellar frost-condensate cap reusing the uFrostLocked eyeball machinery. One new combiner + one emissive term; everything else is already wired.

## 5. Isolation recipe (:9223)

Unbuilt — recipe once built (follow the F8 pattern): register key `magmaOcean` in FEATURES (planet-archetypes.js) with enableKey `magmaOceanEnabled`, archetype 'volcanic' (or a new exotic archetype). Then on the :9223 debug Chrome (chrome-devtools MCP, per well-dipper-testing-reference.md): open planet-lod-lab.html; `window._lab.setPreset('Lava (hot airless)')` — it already carries T_eq 950, tidally locked, resurfacingRate 0.95; `window._lab.solo('magmaOcean')`; judge at three distances via `window._lab.state.distance = 20` (full-disc hemispheric day/night read), `= 6` (shoreline/terminator band — drag yaw so the terminator is center-frame), `= 2` (sea churn + crack-plate close-up, LOD octave ramp engaged). Set `window._lab.state.debugMode = 6` to verify the substellar field driving the zones, and toggle `emissive` in the Envelope folder to confirm the magma glow comes from the new combiner, not the old whole-surface stand-in.

## 6. What to judge (UAT checklist)

- [ ] Does the molten dayside read as one coherent hemispheric SEA — smooth, relief-suppressed, glowing — clearly distinct from solid dark rock, at full-disc distance in the 6-level posterized envelope?
- [ ] Does the shoreline sit at a believable substellar angle and read as a transition BAND (crusting plates, crack glow, raft fragments) rather than a hard binary paint edge?
- [ ] Does the incandescence behave like temperature — whiter/brighter toward the substellar point, deepening to dull red at the shore — with the glow staying crisp via the emissive bypass instead of banding into the posterizer?
- [ ] Does the open sea read as slowly churning fluid (drifting domain-warp swirl, subtle pulse) rather than a scrolling texture or static noise, and does the motion stay deterministic on re-approach?
- [ ] Does the nightside read as cold condensate plains — frost-bright patches over dark rock in the antistellar cap — rather than featureless black?
- [ ] Does the terminator gradient quantize intentionally into the 6 levels (clean stepped bands under 4x4 Bayer) without flicker or dither shimmer as the camera moves?
- [ ] At close distance, does shoreline crack/plate detail ramp in pop-free with the LOD octave ramp, and does the molten zone still suppress mountains/craters (a sea has no relief)?

────────── below filled during UAT, NOT by the workflow ──────────

## 7. Verdict + tweak log

- Rating: (pending)
- Max's feedback: (pending)
- Tweaks applied: (pending)
- Re-verify: (pending)
- Status: open
