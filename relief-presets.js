// relief-presets.js — test bodies, fields transcribed from planet-lod-lab.html DRIVER_PRESETS.
// Shape = the driver bundle relief-base-step consumes (mirrors deriveUniforms' reads).
// Numbers copied verbatim: rocky←'Rocky (Earthlike)' (:2477), lava←'Lava (hot airless)' (:2478),
// magma←'Magma (K2-141b)' (:2583), europa←'Europa (icy moon)' (:2487). `age` is absent from
// DRIVER_PRESETS → omitted (base step default-coalesces to 0.5).
export const PRESETS = {
  rocky:  { composition:{ ironFraction:0.32, density:5.5, volatileFraction:0.15 }, T_eq:288,  eccentricity:0.017, orbitRadiusEarth:23455, starMassEarth:332946, radiusEarth:1.0, massEarth:0.9,   surfaceHistory:{ erosion:0.4 } },
  lava:   { composition:{ ironFraction:0.7,  density:7.0, volatileFraction:0.02 }, T_eq:950,  eccentricity:0.15,  orbitRadiusEarth:938,   starMassEarth:332946, radiusEarth:0.9, massEarth:0.65,  surfaceHistory:{ erosion:0.0 } },
  magma:  { composition:{ ironFraction:0.4,  density:8.0, volatileFraction:0.0  }, T_eq:2000, eccentricity:0.01,  orbitRadiusEarth:212,   starMassEarth:332946, radiusEarth:1.5, massEarth:5.0,   surfaceHistory:{ erosion:0.0 } },
  europa: { composition:{ ironFraction:0.2,  density:2.0, volatileFraction:0.5  }, T_eq:110,  eccentricity:0.1,   orbitRadiusEarth:2500,  starMassEarth:332946, radiusEarth:0.5, massEarth:0.07,  surfaceHistory:{ erosion:0.05 } },
};
