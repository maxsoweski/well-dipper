// planet-drivers.js
// The canonical L0 DRIVERS (D1–D16) and L1 PROCESSES (P1–P28) of the planet
// feature model, transcribed from docs/FEATURES/planet-visual-features.md (the
// physics-first driver→process→feature model) and grounded in the game's real
// generation physics (src/generation/PhysicsEngine.js + PlanetGenerator.js).
//
// This is the SOURCE OF TRUTH for the driver vocabulary. planet-feature-associations.js
// declares each feature's `processes:[P#]` and DERIVES `dependsOn.drivers` from the
// process→driver table here — so the manifest's driver column cannot drift from the
// model (the same derive-don't-hand-author discipline used for `modifies`).
//
// Re-based 2026-06-14 (Max: "re-base all 47 on D1–D16"). The prior manifest hand-listed
// DERIVED lab uniforms (erosion, liquidStability, surfaceGravity…); those are L1-process
// OUTPUTS, not L0 drivers. They are replaced here by the canonical L0 set.

// ── L0 — Drivers (D1–D16) ──
// key = canonical driver name (what dependsOn.drivers entries reference).
// `where` cites the live game physics that computes it (planet-visual-features.md §L0).
export const DRIVERS = {
  tempEq:           { id: 'D1',  label: 'equilibrium temperature (insolation → surface temp; master volatile/habitability gate)', where: 'PhysicsEngine.equilibriumTemperature:121' },
  volatileFraction: { id: 'D2',  label: 'frost-line volatile/ice budget',                                                       where: 'deriveComposition:357' },
  axialTilt:        { id: 'D3',  label: 'obliquity → seasons, polar-cap cycling, frost-line latitude',                          where: 'PlanetGenerator.js:654' },
  atmoComposition:  { id: 'D4',  label: 'atmosphere composition (n2-o2 / co2 / h2-he / none) → cloud species, haze, sky color', where: 'computeAtmosphere:140' },
  atmoDensity:      { id: 'D5',  label: 'atmosphere density/pressure → wind transport, opacity, pressure-gated volcanism',       where: 'computeAtmosphere:140' },
  atmoRetention:    { id: 'D6',  label: 'atmosphere retention (Jeans escape + UV stripping; gated by D13 magneticField)',        where: 'computeAtmosphere (Jeans:96, escapeVel:81)' },
  tidalLock:        { id: 'D7',  label: 'tidal-lock state → eyeball climate, substellar magma, terminator rings',               where: 'checkTidalLock:274' },
  rotation:         { id: 'D8',  label: 'rotation rate (0 if locked) → zonal banding, jets, Coriolis storms',                   where: 'PlanetGenerator.js:659' },
  ironFraction:     { id: 'D9',  label: 'core iron → magnetic-field strength (D13) and surface mineralogy',                     where: 'deriveComposition:350' },
  carbonToOxygen:   { id: 'D10', label: 'C/O ratio → carbon-planet surfaces (graphite/diamond/carbide, tar plains)',           where: 'deriveComposition:344' },
  surfaceHistory:   { id: 'D11', label: 'impact flux + resurfacing budget → terrain age (the "how long ago / how extreme")',    where: 'computeSurfaceHistory:733' },
  tidalHeating:     { id: 'D12', label: 'tidal flexing → interior heat → resurfacing, cryovolcanism, Io-grade volcanism',       where: 'tidalHeating:295' },
  magneticField:    { id: 'D13', label: 'field strength (ironFraction × rotation) — cross-cutting GATE for aurora + retention', where: 'PhysicsEngine.js:168 / PlanetGenerator.js:440' },
  massGravity:      { id: 'D14', label: 'mass / surface gravity → crater morphology, shield-volcano scale, dune repose',        where: 'estimateMassEarth:61' },
  habitability:     { id: 'D15', label: 'composite liveability score (the RESULT of D1/D4/D6/D9/D7…) → biotic + artificial overlays', where: 'habitabilityScore:576' },
  age:              { id: 'D16', label: 'surface/planet age → weathering time, crater accumulation, biosphere/technosphere development', where: 'derived (stellarEvolution:653)' },
};

// ── L1 — Processes (P1–P28) ──
// Each process maps to the L0 drivers it consumes (planet-visual-features.md §L1).
// `drivers` arrays use DRIVERS keys. P27/P28 are the L1c biotic/technogenic track
// (drivers = habitability + age, not erosion physics — they coat a habitable base world).
export const PROCESSES = {
  P1:  { label: 'Impact cratering',            drivers: ['surfaceHistory','massGravity','atmoDensity','volatileFraction'] },
  P2:  { label: 'Tectonic deformation',        drivers: ['surfaceHistory','tidalHeating','massGravity','age','volatileFraction'] },
  P3:  { label: 'Orogeny (plate tectonics)',   drivers: ['tidalHeating','massGravity','habitability'] },
  P4:  { label: 'Volcanism (effusive)',        drivers: ['tidalHeating','massGravity','atmoDensity','surfaceHistory'] },
  P5:  { label: 'Volcanism (explosive)',       drivers: ['tidalHeating','volatileFraction','atmoComposition','massGravity'] },
  P6:  { label: 'Tidal-heat resurfacing',      drivers: ['tidalHeating','tidalLock','massGravity'] },
  P7:  { label: 'Cryovolcanism',               drivers: ['volatileFraction','tidalHeating','tempEq'] },
  P8:  { label: 'Fluvial erosion/deposition',  drivers: ['tempEq','volatileFraction','atmoRetention','massGravity','atmoComposition'] },
  P9:  { label: 'Aeolian (wind) transport',    drivers: ['atmoDensity','rotation','massGravity','tempEq','volatileFraction','atmoRetention'] },
  P10: { label: 'Glacial flow',                drivers: ['volatileFraction','tempEq','massGravity','axialTilt'] },
  P11: { label: 'Sublimation / volatile etch', drivers: ['tempEq','volatileFraction','axialTilt','atmoDensity'] },
  P12: { label: 'Mass-wasting',                drivers: ['massGravity','volatileFraction'] },
  P13: { label: 'Coastal / shoreline action',  drivers: ['tempEq','volatileFraction','atmoRetention','massGravity'] },
  P14: { label: 'Karst / chemical dissolution',drivers: ['tempEq','volatileFraction','atmoRetention','surfaceHistory','atmoComposition'] },
  P15: { label: 'Crustal tessellation / fracture', drivers: ['surfaceHistory','age','tidalHeating'] },
  P16: { label: 'Zonal banding',               drivers: ['rotation','atmoDensity','tempEq'] },
  P17: { label: 'Vortex / storm formation',    drivers: ['rotation','atmoDensity'] },
  P18: { label: 'Cloud condensation',          drivers: ['atmoComposition','atmoDensity','tempEq'] },
  P19: { label: 'Photochemical haze',          drivers: ['atmoComposition','tempEq','atmoRetention'] },
  P20: { label: 'Meridional circulation',      drivers: ['tempEq','axialTilt','rotation','atmoDensity','volatileFraction'] },
  P21: { label: 'Tidally-locked circulation',  drivers: ['tidalLock','tempEq','rotation','atmoDensity','volatileFraction'] },
  P22: { label: 'Seasonal volatile cycling',   drivers: ['axialTilt','tempEq','volatileFraction','atmoDensity'] },
  P23: { label: 'Aerosol / dust lofting',      drivers: ['atmoDensity','tempEq','axialTilt','massGravity'] },
  P24: { label: 'Aurora & airglow',            drivers: ['magneticField','atmoComposition','tempEq'] },
  P25: { label: 'Atmospheric escape / stripping', drivers: ['magneticField','atmoRetention','massGravity','tempEq'] },
  P26: { label: 'Optical / atmospheric scattering', drivers: ['atmoDensity','atmoRetention'] },
  P27: { label: 'Biospheric colonization',     drivers: ['habitability','atmoRetention','tempEq','age'] },
  P28: { label: 'Technospheric development',   drivers: ['habitability','age','tidalLock'] },
};

// Resolve a feature's full L0 driver set = union of its processes' drivers + any
// directDrivers (features that read a driver outside a process, e.g. carbon ← D10).
// Returned sorted by D-number for stable, legible output.
export function driversFor(processes = [], directDrivers = []) {
  const set = new Set(directDrivers);
  for (const p of processes) for (const d of (PROCESSES[p]?.drivers || [])) set.add(d);
  return [...set].sort((a, b) => Number(DRIVERS[a].id.slice(1)) - Number(DRIVERS[b].id.slice(1)));
}
