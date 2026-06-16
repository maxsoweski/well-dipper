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

// ── Planet Size Ranges (Earth radii, per type) ──

// Size ranges in Earth radii — based on real exoplanet science.
// These are realistic physical sizes used for scene-scale rendering.
// Single source of truth shared by the game (PlanetGenerator.generate)
// and the planet-LOD lab (seeded radius draw + reroll).
export const RADIUS_RANGES_EARTH = {
  'rocky':        [0.3, 0.8],    // Mercury (0.38) to Mars (0.53)
  'terrestrial':  [0.8, 1.5],    // Venus (0.95) to super-Earth
  'ocean':        [0.8, 1.8],    // Earth-like to large water worlds
  'eyeball':      [0.8, 1.3],    // Tidally locked terrestrial
  'venus':        [0.8, 1.2],    // Venus-like (0.95 real)
  'carbon':       [0.4, 0.9],    // Small, dense worlds
  'lava':         [0.3, 1.0],    // Small hot worlds
  'ice':          [0.4, 1.2],    // Icy bodies
  'sub-neptune':  [2.5, 4.0],    // Mini-Neptunes (Neptune = 3.88)
  'gas-giant':    [6.0, 14.0],   // Jupiter (11.2) / Saturn (9.4)
  'hot-jupiter':  [8.0, 16.0],   // Inflated close-in giants
  'hex':          [0.4, 0.9],    // Small artificial construct
  'shattered':    [0.5, 1.2],    // Medium fractured world
  'crystal':      [0.3, 0.8],    // Small crystalline body
  'fungal':       [0.6, 1.3],    // Medium bio world
  'machine':      [0.8, 1.5],    // Medium artificial world
  'city-lights':  [0.8, 1.5],    // Earth-like with civilization
  'ecumenopolis': [0.9, 1.8],    // Mega-city, often super-Earth sized
};

/** Convert AU to scene units */
export function auToScene(au) {
  return au * AU_TO_SCENE;
}

/** Convert scene units to AU */
export function sceneToAu(scene) {
  return scene / AU_TO_SCENE;
}

// ── Light-Year Conversion ──
//
// Per Game Bible §Scale System: 1 light-year = 63241.077 AU (IAU 2012
// Julian year × c). Added 2026-04-24 for the telemetry-reckoning
// workstream so ship speed can be reported in fraction-of-light-year/sec
// alongside scene-units/sec — the scale Max's felt-intuition maps to.

export const LIGHT_YEAR_AU = 63241.077;

/** Convert light-years to scene units. */
export function lyToScene(ly) {
  return ly * LIGHT_YEAR_AU * AU_TO_SCENE;
}

/** Convert scene units to light-years. */
export function sceneToLy(scene) {
  return scene / (LIGHT_YEAR_AU * AU_TO_SCENE);
}

// ── Meter Conversion ──

// 1 AU is defined as exactly 149,597,870,700 meters (IAU 2012).
// 1 scene unit = 1 AU / AU_TO_SCENE = 149,597,870.7 m (~149,598 km).
// So 1 meter = 1 / 149,597,870.7 ≈ 6.685×10⁻⁹ scene units.
export const METERS_PER_AU = 149597870700;
export const METERS_PER_SCENE = METERS_PER_AU / AU_TO_SCENE;

/** Convert meters to scene units */
export function metersToScene(m) {
  return m / METERS_PER_SCENE;
}

/** Convert scene units to meters */
export function sceneToMeters(scene) {
  return scene * METERS_PER_SCENE;
}

// ── Ship & Station Hull Sizes ──
//
// Realistic baseline per Game Bible §10 Scale System + §8A.
// Everything renders at true real-world scale; augmented vision layer
// (StarFlare bloom, constant-screen-size billboards, periscope magnifier)
// handles visibility at distance. See docs/SCALE_AUDIT.md for the full
// derivation.
//
// Adding a new archetype: add its length in meters here. Every caller
// (ShipSpawner, HUD, nav computer, targeting) must pull from this table —
// no ad-hoc scene-unit hardcodes.

export const SHIP_HULL_LENGTHS_M = {
  // Player ship: house-sized, unusually small by design.
  // Breakaway-line engineering — hand-built, compact, peer with a family
  // home or a Millennium Falcon without the wings.
  player:     20,

  // Plural keys align with `assets/ships/manifest.json`. Callers pick
  // a manifest archetype → this table maps directly to hull length.
  fighters:   50,    // Real fighters 15 m (F-22) to 25 m; padded for legibility.
  shuttles:   50,    // Space Shuttle Orbiter 37 m; interstellar variant larger.
  freighters: 300,   // Supertanker 400 m.
  cruisers:   500,   // Naval cruiser 170 m; sci-fi cruiser scaled up.
  capitals:   2000,  // Rare showpiece. Star Destroyer 1.6 km.
  explorers:  200,   // Dedicated long-range survey vessel.
};

export const STATION_HULL_LENGTHS_M = {
  outpost:   500,    // ISS-scale + near-future buildout.
  habitat:   10000,  // O'Neill-cylinder rotating habitat.
};

/** Hull length in scene units for an archetype key. Throws if unknown. */
export function shipHullToScene(archetype) {
  const m = SHIP_HULL_LENGTHS_M[archetype];
  if (m === undefined) throw new Error(`Unknown ship archetype: ${archetype}`);
  return metersToScene(m);
}

/** Hull length in scene units for a station kind. Throws if unknown. */
export function stationHullToScene(kind) {
  const m = STATION_HULL_LENGTHS_M[kind];
  if (m === undefined) throw new Error(`Unknown station kind: ${kind}`);
  return metersToScene(m);
}

/** Player ship hull length in scene units — shortcut for the canonical player. */
export function playerShipLengthScene() {
  return shipHullToScene('player');
}

// ── Portal Geometry Ratios ──
//
// The pocket's core dimensions — aperture/interior radius and tunnel length —
// are now FIXED human-scale values (WARP_POCKET_RADIUS / WARP_POCKET_LENGTH),
// not ship-derived; see portalApertureScene() / tunnelInteriorRadiusScene() /
// tunnelLengthScene() below and the warp pocket migration. The ratios here are
// the dimensions that REMAIN derived from the player ship length: the post-exit
// rest distance and the destination-side landing strip span. See Game Bible §10
// Scale System and docs/SCALE_AUDIT.md Task 4 for the original derivation.

export const POST_EXIT_DISTANCE_TO_SHIP    = 5;    // final camera distance past Portal B on EXIT end — symmetric with preview
export const PORTAL_LANDING_STRIP_TO_SHIP  = 100;  // span of the destination-side landing strip = 100× ship length

/** Portal aperture radius in scene units. Human-scale to match the warp
 *  pocket disc/interior (lab: 3u) so the portal opening, the tunnel interior,
 *  and the traversal gate all share one radius. Warp-only. */
export function portalApertureScene() {
  return WARP_POCKET_RADIUS;
}

/** Portal A spawn/preview distance in scene units — how far ahead of the
 *  ship Portal A opens when warp begins. Its OWN constant, deliberately NOT
 *  derived from the pocket length: deriving it (old: tunnelLength/2 = 30u)
 *  meant spawn distance and tunnel length could only be tuned together.
 *  10u ≈ Max's "spawn ~100m away" in pocket-feel scale (the 3u aperture
 *  swallows the 20m ship → ~1u ≈ 10m; literal metersToScene(100) ≈ 6.7e-7u,
 *  the sub-micron-pocket problem). foldPeakSpeedScenePerSec stays derived
 *  from THIS value, so the FOLD ramp still lands the camera exactly at
 *  Portal A's plane at FOLD end regardless of tuning. Warp-only. */
export const WARP_PORTAL_PREVIEW_DISTANCE = 10;

/** Live preview distance — checks the UAT feel-tuning override
 *  `window._warpPreviewDist` (read per warp: spawn position at FOLD t=0,
 *  fold/enter speeds re-derived in WarpEffect.start()). */
export function portalPreviewDistanceScene() {
  const o = globalThis._warpPreviewDist;
  return (typeof o === 'number' && o > 0) ? o : WARP_PORTAL_PREVIEW_DISTANCE;
}

/** Distance past Portal B where the camera comes to rest at end of EXIT.
 *  Symmetric with preview distance so Portal B is the same distance behind
 *  the ship at arrival as Portal A was ahead at departure. */
export function postExitDistanceScene() {
  return playerShipLengthScene() * POST_EXIT_DISTANCE_TO_SHIP;
}

// ── Hyperspace Tunnel — Human-Scale "Pocket" ──
//
// The warp tunnel is a FIXED human-scale pocket the camera physically flies
// through, matching portal-traversal-lab.html (60u long, 3u disc/interior
// radius). It is NOT derived from ship length — deriving from ship scale put
// the whole rig at AU/light-year scale (tunnel ≈ 6.68e-5u, aperture ≈ 1.3e-7u),
// a sub-micron pocket the camera couldn't reliably stay inside, so the warp
// rendered black. A fixed ~60u pocket gives real, forgiving geometry.
//
// These constants are warp-only — every caller of the functions below is part
// of the warp/portal pipeline (WarpEffect, WarpPortal, main.js FOLD spawn).

export const WARP_POCKET_LENGTH            = 60;   // scene units — fixed pocket length (lab: 60u)
export const WARP_POCKET_RADIUS            = 3;    // scene units — fixed gate / interior / disc radius (lab: 3u)

/** Tunnel length in scene units — fixed human-scale pocket (60u). */
export function tunnelLengthScene() {
  return WARP_POCKET_LENGTH;
}

/** Tunnel interior cylinder radius in scene units — fixed human-scale (3u). */
export function tunnelInteriorRadiusScene() {
  return WARP_POCKET_RADIUS;
}

// Legacy aliases (callers may still import these; keep them pointing at the
// derived values so everything tracks ship scale).
export const TUNNEL_LENGTH_SCENE           = tunnelLengthScene();
export const TUNNEL_INTERIOR_RADIUS_SCENE  = tunnelInteriorRadiusScene();

// ── Ship Speeds ──
//
// All four warp phases run at ship-scale now (no abstract hyperspace-unit
// speeds). HYPER speed is derived from tunnelLength / HYPER_DUR so the
// tunnel is traversed exactly in the HYPER duration. EXIT peak is derived
// from postExit / EXIT_DUR so the camera coasts exactly the target distance
// past Portal B. HYPER→EXIT transition has a small speed drop (ship exits
// hyperspace and decelerates to cruise) — a lore beat, not a visual fudge.

export const SHIP_APPROACH_SPEED_MS        = 200;  // rough peak ship-scale approach speed (informational)

/** FOLD-phase peak camera speed in scene units per second.
 *  Derived so that a quadratic ramp 0→peak over FOLD_DUR covers the preview
 *  distance by the END of FOLD: integral = peak × FOLD_DUR / 3. */
export function foldPeakSpeedScenePerSec(foldDurSec) {
  return 3 * portalPreviewDistanceScene() / foldDurSec;
}

/** HYPER-phase constant camera speed in scene units per second.
 *  Set so a constant velocity over HYPER_DUR covers exactly the tunnel
 *  length — camera crosses Portal B right at HYPER→EXIT transition. */
export function hyperTraversalScenePerSec(hyperDurSec) {
  return tunnelLengthScene() / hyperDurSec;
}

/** EXIT-phase peak camera speed in scene units per second — speed at the
 *  moment EXIT begins, then linearly decays to 0 over EXIT_DUR.
 *  Derived so the camera covers exactly postExitDistance during EXIT. */
export function exitPeakSpeedScenePerSec(exitDurSec) {
  return 2 * postExitDistanceScene() / exitDurSec;
}

// Back-compat export so old callers still resolve (now a named constant
// computed at import time using HYPER_DUR = 3).
export const HYPER_TRAVERSAL_SCENE_PER_S   = hyperTraversalScenePerSec(3);
