// ═══════════════════════════════════════════════════════════════════════════════════════════════
// AGENT-FACING FRAMING — put the camera at a known multiple of a body's radius, and report what
// the renderer actually did there.
//
// Max, 2026-08-10: "we pretty obviously need to build/modify a better system for you to drive in
// orrery, snap to planets/moons/stars at various radii without having to use the human interface".
//
// ⛔ THE THREE FACTS THIS MODULE EXISTS TO ENCODE. Every one was paid for by a scripted-pose attempt
// that reported success and was wrong; an implementation that does not know them fails SILENTLY.
//
// 1. WRITING THE CAMERA DOES NOT HOLD. ShipCameraSystem recomputes the camera from yaw/pitch/
//    distance on every update, and CameraInterpolator then lerps it between the snapshots it took
//    itself. The supported move is to write the CONTROLLER'S OWN STATE (which is what it recomputes
//    FROM) and then announce the discontinuity, which is what `resync` is for. The previous hook
//    wrote the camera and never announced anything: it returned posDelta 0 with the pose reading
//    back correctly, and the camera was hundreds of units away one frame later.
//
// 2. THE ANNOUNCEMENT MUST COME AFTER THE PLACEMENT. `resync` collapses both interpolator snapshots
//    onto the camera's CURRENT pose. Called before the controller has placed the camera it pins the
//    OLD pose perfectly — a resync in the wrong order is worse than none, because it makes the stale
//    frame stable and therefore convincing.
//
// 3. THE GAME REBASES COORDINATES. A camera position and a mesh's world matrix are not necessarily
//    in the same frame, and differencing them across a rebase produced a measured 26,824 body radii
//    for a camera genuinely at 1.8. Every distance here is taken through getWorldPosition /
//    getWorldScale on the live scene graph, which is the frame the renderer itself draws in.
// ═══════════════════════════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { bodyRadiusOf } from '../rendering/LabPlanetMaterial.js';
import { lodPredictionAt } from '../../planet-lod-lab-core.js';

const _wp = new THREE.Vector3();
const _scl = new THREE.Vector3();

/**
 * A body's position and radius in the frame the renderer draws in.
 *
 * ⚠ `radiusOverride` exists for stars, and is not a convenience. A star's drawn mesh is not a unit
 * sphere scaled to its radius the way a planet surface is — its authored radius lives on its data
 * record, and deriving one from the geometry bounding sphere instead yields a number in a different
 * unit that still looks plausible. Passing the authored value keeps "distance in body radii"
 * meaning the same thing for every body kind.
 *
 * @param {THREE.Object3D} group the body's transform holder (what actually carries world position)
 * @param {THREE.Mesh} mesh the drawn surface (geometry source for the radius)
 * @param {number|null} [radiusOverride] authored radius, in the group's own world scale
 * @returns {{worldPos: THREE.Vector3, worldRadius: number|null}} worldPos is a fresh vector
 */
export function bodyWorldMetrics(group, mesh, radiusOverride = null) {
  const host = group || mesh;
  if (!host) return { worldPos: new THREE.Vector3(), worldRadius: null };
  host.getWorldPosition(_wp);
  host.getWorldScale(_scl);
  const scale = Math.max(_scl.x, _scl.y, _scl.z);
  const localR = radiusOverride != null ? radiusOverride : (mesh?.geometry ? bodyRadiusOf(mesh.geometry) : null);
  return {
    worldPos: _wp.clone(),
    worldRadius: localR == null ? null : localR * scale,
  };
}

/**
 * Measure where the camera ACTUALLY ended up, in body radii.
 *
 * ⭐ This is the whole reason the API returns a number instead of echoing the asked-for one. Both
 * front-ends clamp the near end — the game holds a zoom floor just above the surface, the lab raises
 * any distance below its own clearance — so in exactly the close regime the approach criterion is
 * about, asked and achieved diverge. A hook that reported the request back would report the floor as
 * though it had been honoured.
 *
 * @returns {{distanceScene: number, bodyRadiusScene: number|null, distanceRadii: number|null}}
 */
export function measureFraming(camera, group, mesh, radiusOverride = null) {
  const { worldPos, worldRadius } = bodyWorldMetrics(group, mesh, radiusOverride);
  const distanceScene = camera.position.distanceTo(worldPos);
  return {
    distanceScene,
    bodyRadiusScene: worldRadius,
    distanceRadii: worldRadius ? distanceScene / worldRadius : null,
  };
}

/**
 * The LOD state at an achieved distance, live and predicted, reported SEPARATELY.
 *
 * ⛔ DO NOT COLLAPSE THESE INTO ONE FIELD. `live` is what the body's material is actually carrying
 * right now; `predicted` is what the shared LOD law says that distance implies. They agree on a body
 * whose LOD is being driven and disagree on one whose is not — which is the only signal that
 * distinguishes "correctly at 4 octaves because it is far away" from "frozen at the 4.0 default
 * because nothing ever updates it".
 * ⚠ PLANET-CLASS MOONS USED TO BE THE EXAMPLE HERE AND ARE NOT ANY MORE. They were built down a
 * branch that never registered them with LODManager; as of 2026-08-11 they are registered
 * (src/rendering/objects/PlanetMoonBody.js). The instrument FOUND that — body `Al` read 4.00 at 8
 * radii against a predicted 8.72 — which is what this pair is for. The population still in the
 * second category is the PLAIN moons, and their signature is different: they carry no octave
 * uniform at all, so they report `live.octaves: null` rather than a disagreement. Step 10.
 *
 * ⛔⛔ TWO UNIFORM NAMES CARRY ONE LAW, AND READING ONLY THE LAB'S IS THE DEFECT THIS FUNCTION
 * SHIPPED WITH (review 2026-08-11, defect 1). The lab material spells the octave count `uOctaves`;
 * the GAME'S OWN material spells it `uReliefOctaves` (src/objects/Planet.js:1674 `uReliefOctaves: { value: RELIEF_OCTAVES },`)
 * and is driven through the IDENTICAL law by
 * src/rendering/objects/BodyRenderer.js:216 `const next = autoOctaves(lodRampOf(distanceRadii));`,
 * with no quality tier — which is exactly what `lodPredictionAt` computes at the 1.0 default. So the
 * prediction is directly comparable against either spelling.
 * ⚠ AT THE SHIPPED 6e DEFAULT the second spelling is the COMMON case, not the exotic one: reading
 * `uOctaves` alone reported every ordinary game planet — LODManager-registered and correctly driven —
 * as "does not render through the LOD-driven path at all", which was false for 41 of 50 bodies. That
 * is the same shape as the scar BodyRenderer.js:204 already carries: two differently-named uniforms,
 * one silent no-op each. `live.octaveUniform` NAMES which spelling answered, so a future third
 * spelling shows up as a null instead of as a confident wrong sentence.
 * ⚠ `uLodRamp` is the LAB material's only, so `live.ramp` is legitimately null on the game path.
 *
 * @returns {{live: object, predicted: object, agrees: boolean|null, note: string|null}}
 */
export function lodStateOf(mesh, achievedRadii, qualityTier = 1.0) {
  const u = mesh?.material?.uniforms || {};
  const labOct = u.uOctaves?.value ?? null;
  const gameOct = u.uReliefOctaves?.value ?? null;
  const liveOct = labOct != null ? labOct : gameOct;
  // Named rather than inferred from the value: 4.0 is a legal reading of BOTH uniforms.
  const octaveUniform = labOct != null ? 'uOctaves' : (gameOct != null ? 'uReliefOctaves' : null);
  const liveRamp = u.uLodRamp?.value ?? null;
  const predicted = achievedRadii == null ? null : lodPredictionAt(achievedRadii, qualityTier);

  let agrees = null;
  let note = null;
  if (liveOct == null) {
    note = 'this body carries neither uOctaves nor uReliefOctaves — it does not render through the LOD-driven path at all';
  } else if (predicted) {
    // 0.01 octaves: far tighter than any real ramp step, loose enough that float round-trips through
    // a uniform do not read as a disagreement.
    agrees = Math.abs(liveOct - predicted.octaves) <= 0.01;
    if (!agrees) {
      note = `LIVE AND PREDICTED DISAGREE (live ${liveOct.toFixed(2)} ${octaveUniform} vs predicted ${predicted.octaves.toFixed(2)} octaves) `
        + '— this body\'s LOD is not being driven at its own distance, i.e. it is not registered with '
        + 'LODManager or its registration is not reaching the material. Planet-class moons were the '
        + 'known case and were fixed 2026-08-11; a disagreement here now is UNEXPECTED and worth reading.';
    }
  }
  return {
    live: { octaves: liveOct, ramp: liveRamp, octaveUniform },
    predicted,
    agrees,
    note,
  };
}

/**
 * Place the camera at `viewDistance` from `worldPos` and make it STICK.
 *
 * The ordering below is the entire content of this function and it is not interchangeable:
 *
 *   1. clear `bypassed` — a previous `setCameraPose` leaves it set, and `update()` returns
 *      immediately when it is, so steps 2-4 would run against a controller that never moves
 *      the camera and the whole call would no-op while reporting success
 *   2. `focusOn` — writes target/yaw/pitch and snaps BOTH `distance` and `smoothedDistance`, so the
 *      orbit placement happens from the requested state instead of easing toward it
 *   3. `update(0)` — place the camera NOW. dt 0 is deliberate: it advances no easing, no auto-drift
 *      and no zoom lerp, so what lands is the pose the state describes and not a point on the way to it
 *   4. `resync` — collapse both interpolator snapshots onto the pose from step 3, so the next
 *      rendered blend is a no-op instead of dragging the camera back toward where it used to be
 *
 * ⚠ `autoRotateActive` is turned off. It is a 0.67 deg/s drift that runs whenever nothing is
 * dragging — nothing over one frame, and enough to move the disc between two rungs of a sweep or
 * between the two halves of an A/B pair.
 *
 * @returns {{bypassClearedFrom: boolean, autoRotateClearedFrom: boolean}} what had to be undone —
 *   reported rather than silently corrected, because either being set means something else had left
 *   the camera in a state where scripted framing does not work.
 */
export function frameSequence({ camera, cameraController, cameraInterp, worldPos, viewDistance }) {
  const bypassClearedFrom = !!cameraController.bypassed;
  const autoRotateClearedFrom = !!cameraController.autoRotateActive;

  cameraController.bypassed = false;
  cameraController.autoRotateActive = false;

  cameraController.focusOn(worldPos, viewDistance);
  cameraController.update(0);
  camera.updateMatrixWorld(true);
  cameraInterp.resync(camera);

  return { bypassClearedFrom, autoRotateClearedFrom };
}
