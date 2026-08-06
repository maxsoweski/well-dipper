// src/flight/proximityHorizon.js
//
// Pure escape-velocity "horizon" math for the supercruise forced drop-out
// (spec 2026-06-28-sublight-flight-collision §2). The forced-drop distance is
// the distance where escape velocity rises to meet the ship's reference speed:
//   d_horizon = 2·G·M / v_ref²   (∝ mass; radius enters only as the floor, in the model)
// Only stars are massive enough for this to exceed the radius floor — planets/
// moons are floor-dominated, so we only ever feed star mass.
//
// No THREE, no DOM — pure arithmetic + constants.
import { G, M_SUN } from '../generation/PhysicsEngine.js';
import { METERS_PER_SCENE, metersToScene, solarRadiiToScene } from '../core/ScaleConstants.js';

const SCENE_PER_SOLAR_RADIUS = solarRadiiToScene(1); // 4.65 scene-u per solar radius

/** Re-derive a star's mass (kg) from its rendered scene radius, using the
 *  generator's own mass-radius relation massSolar = radiusSolar^1.25
 *  (StarSystemGenerator.js:239). Avoids persisting mass upstream. */
export function starMassKgFromSceneRadius(sceneRadius) {
  const solarRadii = sceneRadius / SCENE_PER_SOLAR_RADIUS;
  const massSolar = Math.pow(solarRadii, 1.25);
  return massSolar * M_SUN;
}

/** Forced-drop horizon distance in SCENE units for a body of mass `massKg`,
 *  given the ship's reference speed in scene-units/sec. Returns 0 for falsy mass. */
export function forcedDropRadiusScene(massKg, vRefScenePerSec) {
  if (!massKg || massKg <= 0) return 0;
  const vRefMps = vRefScenePerSec * METERS_PER_SCENE; // scene-u/s → m/s
  const dMeters = (2 * G * massKg) / (vRefMps * vRefMps);
  return metersToScene(dMeters);
}
