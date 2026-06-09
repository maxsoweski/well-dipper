# Profiles Card — per-type feature validation (Phase 6)

For each Appendix-A type: load/author its lab preset (driver bundle), render on
:9223, check expected features PRESENT and wrong features ABSENT, sanity-check
deriveUniforms() driver values, screenshot to shots/PRO-<type>-NN.png, verdict.
Regression net: npx vitest run tests/planet-archetypes.test.js after any
registry/preset change. Types are presets over drivers (Appendix A) — a profile
failure is usually a DRIVER WIRING bug, not a feature bug.

| Type | Lab preset | Must show | Must NOT show | Verdict |
|---|---|---|---|---|
| rocky | Rocky (Earthlike) — verify driver fit, else author "Rocky (airless Mars-like)" | F1 F2 F3 F5 F8 F19 F40(dust) | clouds, rivers, glow | (pending) |
| terrestrial | Rocky (Earthlike) | F11 F12 F14 F17 F22 F26 F31a F34 F35 F37 (richest) | magma, carbon flats | (pending) |
| ocean | Ocean (temperate) | F14 F20 F36 F31a F34, low relief | mountain belts, dust storms | (pending) |
| ice | Europa (icy moon) | F2 F9 F10 F17 F18 F22 | liquid-water seas, lava | (pending) |
| lava | Lava (hot airless) | F8 F41, emissive cracks | frost, clouds, rivers | (pending) |
| venus | AUTHOR in Phase 6 | F31d blanket, F7 pancake, F29 polar vortex, F25 | visible surface relief through clouds, city lights | (pending) |
| carbon | AUTHOR in Phase 6 | F42 dark crust + diamond glints, hydrocarbon flats | water oceans, green biome tints | (pending) |
| gas-giant | AUTHOR in Phase 6 | F24 F25 F27 F28 F29 F30 | any solid-surface feature | (pending) |
| hot-jupiter | AUTHOR in Phase 6 | F32 F33 F24 (thermal day/night asymmetry) | frost, surface relief | (pending) |
| eyeball | AUTHOR in Phase 6 | F31f pupil+ring, F22 nightside cap + terminator melt ring | uniform global weather | (pending) |
| sub-neptune | AUTHOR in Phase 6 | F31c featureless haze (F31e shells if built) | crisp bands, surface detail | (pending) |
| hex | AUTHOR in Phase 6 | F44 tiling, F29 hexagon hook | natural fluvial/aeolian forms | (pending) |
| shattered | AUTHOR in Phase 6 | F45 fracture blocks, F9 | intact smooth plains everywhere | (pending) |
| crystal | AUTHOR in Phase 6 | F43 facet fields, F3 glints | weather stack | (pending) |
| fungal | AUTHOR in Phase 6 | F46 mats OVER terrestrial/ocean base (base shows through) | overlay erasing base entirely | (pending) |
| machine | AUTHOR in Phase 6 | F47 circuit grid OVER rocky base | natural-only surface | (pending) |
| city-lights | AUTHOR in Phase 6 | F48 nightside cities over terrestrial base | dayside light leakage | (pending) |
| ecumenopolis | AUTHOR in Phase 6 | F49 whole-surface build-out + glow | raw wilderness patches (unless intended) | (pending) |

Notes:
- "AUTHOR in Phase 6" = add a named preset (driver bundle) to the lab presets +
  archetype mapping if missing; presets are data (planet-archetypes.js + lab
  preset list), keep DATA ONLY per that file's header rule.
- Appendix-B cross-check: after all rows verdicted, re-read the coverage matrix
  and confirm no ●/◐ cell contradicts a verdict (e.g. "gas × F-relief = –"
  must mean gas presets show zero relief).

## 7. Verdict + tweak log
(pending)
