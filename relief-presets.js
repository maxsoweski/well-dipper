// relief-presets.js — test bodies, fields transcribed from planet-lod-lab.html DRIVER_PRESETS.
// Shape = the driver bundle relief-base-step consumes (mirrors deriveUniforms' reads).
// Numbers copied verbatim: rocky←'Rocky (Earthlike)' (:2477), lava←'Lava (hot airless)' (:2478),
// magma←'Magma (K2-141b)' (:2583), europa←'Europa (icy moon)' (:2487). `age` is absent from
// DRIVER_PRESETS → omitted (base step default-coalesces to 0.5).
//
// ── BUILD INTENT (read THIS before assuming presets pick different generators) ──
// Function: each preset is a physical body bundle (composition / orbit / thermal). makeBaseStep derives
//   REAL geophysical drivers from it — surface gravity, tidal heat (D12), a silicate↔ice gate (rockyCrust),
//   an erosion budget, a radial-strain sign. So preset response is genuine physics in the COMPUTE layer; the
//   renderer is entirely preset-blind.
// Intent: prove the host-editor mechanism (E6 builds → E9 carves ONE shared substrate) RESPONDS to physics.
//   NOT to demonstrate per-body-type divergence — that was never a slice goal.
// Deliberate NON-GOALS (by design for this slice — these are NOT bugs):
//   • Presets currently modulate AMPLITUDE/INTENSITY only: gravity cap × silicate gate (E6 baseAmp) and
//     erodibility (E9 incision depth). They do NOT select different generators or change formation SHAPE.
//   • Spatial pattern is SEED-LOCKED & preset-independent: E6/E9 seeds exclude the preset, and the tectonic
//     grain bands are latitude-only (Melosh despin). Same seed + different preset = IDENTICAL landform layout,
//     only rescaled in height. (This is exactly the "presets just change amplitude" UAT observation, 2026-06-23.)
//   • radialStrainSign (contraction→scarps vs expansion→grabens) is now UN-DAMPED (Layer 1): it flips the
//     Anderson regime per body (rocky→THRUST-leaning; icy/molten→NORMAL-leaning). Regime divergence is live.
//   • Ocean fraction is hardcoded 0.4 (ignores volatiles/T_eq); precip is latitude-only; palette is height-only
//     (Europa is NOT icy-colored); `age` is the default 0.5 for every preset (absent from the bundle).
// To make presets diverge STRUCTURALLY (future work, not yet scoped): fold composition into the seed/pattern
//   (not just amplitude); derive ocean fraction from volatiles+T_eq; branch ice-vs-silicate
//   texture/erosion modes; add a preset-aware palette + temperature-driven precip.
export const PRESETS = {
  rocky:  { composition:{ ironFraction:0.32, density:5.5, volatileFraction:0.15 }, T_eq:288,  eccentricity:0.017, orbitRadiusEarth:23455, starMassEarth:332946, radiusEarth:1.0, massEarth:0.9,   surfaceHistory:{ erosion:0.4 } },
  lava:   { composition:{ ironFraction:0.7,  density:7.0, volatileFraction:0.02 }, T_eq:950,  eccentricity:0.15,  orbitRadiusEarth:938,   starMassEarth:332946, radiusEarth:0.9, massEarth:0.65,  surfaceHistory:{ erosion:0.0 } },
  magma:  { composition:{ ironFraction:0.4,  density:8.0, volatileFraction:0.0  }, T_eq:2000, eccentricity:0.01,  orbitRadiusEarth:212,   starMassEarth:332946, radiusEarth:1.5, massEarth:5.0,   surfaceHistory:{ erosion:0.0 } },
  europa: { composition:{ ironFraction:0.2,  density:2.0, volatileFraction:0.5  }, T_eq:110,  eccentricity:0.1,   orbitRadiusEarth:2500,  starMassEarth:332946, radiusEarth:0.5, massEarth:0.07,  surfaceHistory:{ erosion:0.05 } },
};
