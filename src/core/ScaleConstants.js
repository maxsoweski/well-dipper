/**
 * ScaleConstants — physical astronomical constants and unit conversions.
 *
 * All generators produce data in physical units (AU, solar radii, Earth radii).
 * These constants convert between physical units and scene units for rendering.
 *
 * Scene scale: 1 AU = 1000 scene units.
 * This gives a G-class star ~4.65 scene units radius — close to the old
 * exaggerated value of 4.5, so the star still looks right up close.
 * But orbital distances become huge (Mercury ~390, Neptune ~30,000),
 * which is the whole point — realistic proportions.
 *
 * Map scale: a compressed version for the system map HUD, where the
 * entire system fits in a small corner overlay.
 */

// ── Physical Constants ──

// Stellar radii in AU (for converting solar radii → scene units)
export const SOLAR_RADIUS_AU = 0.00465;      // 1 solar radius in AU

// Planetary radii in AU (for converting Earth radii → scene units)
export const EARTH_RADIUS_AU = 0.0000426;     // 1 Earth radius in AU

// Jupiter radius in Earth radii (handy for gas giant conversion)
export const JUPITER_RADIUS_EARTH = 11.21;

// ── Scene Conversion (realistic main view) ──

// 1 AU = 1000 scene units
// This means:
//   G-class star (1.0 solar radii) = 0.00465 AU = 4.65 scene units
//   Earth (1.0 Earth radii)        = 0.0000426 AU = 0.0426 scene units
//   Jupiter (11.2 Earth radii)     = 0.000477 AU = 0.477 scene units
//   Mercury orbit (0.39 AU)        = 390 scene units
//   Earth orbit (1.0 AU)           = 1000 scene units
//   Jupiter orbit (5.2 AU)         = 5200 scene units
//   Neptune orbit (30.1 AU)        = 30100 scene units
export const AU_TO_SCENE = 1000;

// ── Map Conversion (exaggerated HUD minimap) ──

// Map compresses distances so the whole system fits in a small overlay
export const MAP_SCALE = 0.2;

// Bodies are boosted in size on the minimap so they're visible as dots
export const MAP_BODY_BOOST = 100;

// ── Conversion Helpers ──

/** Convert solar radii to scene units */
export function solarRadiiToScene(solarRadii) {
  return solarRadii * SOLAR_RADIUS_AU * AU_TO_SCENE;
}

/** Convert Earth radii to scene units */
export function earthRadiiToScene(earthRadii) {
  return earthRadii * EARTH_RADIUS_AU * AU_TO_SCENE;
}

/** Convert AU to scene units */
export function auToScene(au) {
  return au * AU_TO_SCENE;
}

/** Convert scene units to AU */
export function sceneToAu(scene) {
  return scene / AU_TO_SCENE;
}
