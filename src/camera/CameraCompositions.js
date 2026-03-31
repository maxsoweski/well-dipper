/**
 * CameraCompositions -- static helper functions for computing camera orientations.
 *
 * These are pure math utilities that take positions/radii/directions and return
 * lookAt targets or offsets. No state, no mutation -- just geometry.
 *
 * Used by CinematicDirector to compute where the camera should look for
 * different composition styles (planet portrait, leading space, ring framing, etc.).
 */

import * as THREE from 'three';

// Reusable scratch vectors to avoid per-frame allocations
const _scratch1 = new THREE.Vector3();
const _scratch2 = new THREE.Vector3();
const _scratch3 = new THREE.Vector3();

export class CameraCompositions {
  /**
   * Compute a lookAt point that frames a body using rule-of-thirds.
   *
   * Instead of looking dead-center at the body, we offset the lookAt so the
   * body sits roughly 1/3 from the edge of the frame. The body should fill
   * `targetFraction` of the camera's vertical field of view.
   *
   * How it works:
   *   1. Compute the angular size the body occupies at this distance.
   *   2. Figure out how much screen space that is relative to the full FOV.
   *   3. If the body is too small or too large, return center (no offset needed).
   *   4. Otherwise, offset the lookAt perpendicular to the camera-to-body direction
   *      so the body shifts toward one third of the frame.
   *
   * @param {THREE.Vector3} bodyPosition - center of the body in world space
   * @param {number} bodyRadius - radius of the body in scene units
   * @param {THREE.Vector3} cameraPosition - where the camera is
   * @param {THREE.Camera} camera - the Three.js camera (needs .fov)
   * @param {number} [targetFraction=0.5] - how much of the vertical FOV the body should fill (0-1)
   * @returns {THREE.Vector3} the lookAt point (may be offset from body center)
   */
  static framePlanetPortrait(bodyPosition, bodyRadius, cameraPosition, camera, targetFraction = 0.5) {
    const toBody = _scratch1.subVectors(bodyPosition, cameraPosition);
    const distance = toBody.length();

    if (distance < 0.001) {
      return bodyPosition.clone();
    }

    // Angular size of the body (in radians) as seen from the camera
    // Using small angle: angularSize ~ 2 * atan(radius / distance)
    const angularSize = 2 * Math.atan(bodyRadius / distance);

    // Camera's vertical FOV in radians
    const fovRad = (camera.fov ?? 60) * Math.PI / 180;

    // Fraction of vertical FOV that the body currently fills
    const currentFraction = angularSize / fovRad;

    // If body fills less than 5% of the screen, it's too small for portrait framing
    // If it fills more than 90%, it's too close -- just look at center
    if (currentFraction < 0.05 || currentFraction > 0.9) {
      return bodyPosition.clone();
    }

    // Rule-of-thirds offset:
    // We want the body center to sit ~1/6 of FOV away from screen center
    // (which puts the edge at roughly the 1/3 line).
    const offsetAngle = fovRad / 6;

    // Find a perpendicular direction to offset along.
    // Use the world "up" (Y) to create a horizontal offset.
    const forward = _scratch2.copy(toBody).normalize();
    const right = _scratch3.crossVectors(forward, THREE.Object3D.DEFAULT_UP);

    // If forward is nearly parallel to up, fall back to a different axis
    if (right.lengthSq() < 0.001) {
      right.set(1, 0, 0);
    }
    right.normalize();

    // Offset magnitude in world space: at this distance, the angle offset
    // corresponds to this lateral displacement
    const offsetDistance = distance * Math.tan(offsetAngle);

    // Apply offset: shift lookAt so body moves right/up in frame
    const lookAt = bodyPosition.clone();
    lookAt.addScaledVector(right, -offsetDistance * 0.5); // negative to push body to the right third

    return lookAt;
  }

  /**
   * Find a lookAt orientation where the primary body is in the foreground
   * and background bodies are also visible.
   *
   * Strategy: look slightly "past" the primary body toward the centroid
   * of background bodies. This puts the primary in the foreground with
   * distant bodies visible behind/beside it.
   *
   * @param {{ position: THREE.Vector3, radius: number }} primaryBody
   * @param {{ position: THREE.Vector3, radius: number }[]} backgroundBodies
   * @param {THREE.Vector3} cameraPosition
   * @returns {THREE.Vector3} the lookAt point
   */
  static frameWithBackground(primaryBody, backgroundBodies, cameraPosition) {
    if (!backgroundBodies || backgroundBodies.length === 0) {
      return primaryBody.position.clone();
    }

    // Compute centroid of background bodies (weighted by inverse distance for nearby bias)
    const centroid = new THREE.Vector3();
    let totalWeight = 0;

    for (const bg of backgroundBodies) {
      const dist = bg.position.distanceTo(cameraPosition);
      if (dist < 0.001) continue;
      const weight = 1 / dist;
      centroid.addScaledVector(bg.position, weight);
      totalWeight += weight;
    }

    if (totalWeight < 0.0001) {
      return primaryBody.position.clone();
    }

    centroid.divideScalar(totalWeight);

    // Blend: 70% toward primary body, 30% toward background centroid
    // This keeps the primary dominant while pulling the view to include background
    const lookAt = new THREE.Vector3();
    lookAt.lerpVectors(primaryBody.position, centroid, 0.3);

    return lookAt;
  }

  /**
   * Compute a lookAt direction that shows a ring system at a dramatic angle.
   *
   * Rings look best when viewed at ~20-30 degrees from the ring plane,
   * not edge-on (invisible) or face-on (flat circle). This finds a lookAt
   * that tilts the view to show the ring's 3D structure.
   *
   * @param {THREE.Vector3} bodyPosition - center of the ringed body
   * @param {THREE.Vector3} ringNormal - normal vector of the ring plane
   * @param {THREE.Vector3} cameraPosition - where the camera is
   * @returns {THREE.Vector3} the lookAt point (offset to show ring tilt)
   */
  static frameRingSystem(bodyPosition, ringNormal, cameraPosition) {
    const toBody = _scratch1.subVectors(bodyPosition, cameraPosition);
    const distance = toBody.length();

    if (distance < 0.001) {
      return bodyPosition.clone();
    }

    const forward = _scratch2.copy(toBody).normalize();

    // Compute how edge-on we're looking at the rings
    // dot(forward, ringNormal) = cos(angle between view and ring normal)
    // When |dot| is close to 1, we're looking face-on (boring)
    // When |dot| is close to 0, we're looking edge-on (rings invisible)
    // Ideal: |dot| ~ 0.4-0.6 (about 25-35 degrees from ring plane)
    const normalDir = _scratch3.copy(ringNormal).normalize();
    const currentDot = Math.abs(forward.dot(normalDir));

    // If we're already at a good viewing angle, just look at the body
    if (currentDot > 0.3 && currentDot < 0.7) {
      return bodyPosition.clone();
    }

    // Offset the lookAt to tilt the view toward a better ring angle.
    // Push the lookAt point along the ring normal to induce a tilt.
    const targetDot = 0.45; // ~27 degrees from ring plane
    const correction = (targetDot - currentDot) * distance * 0.3;

    const lookAt = bodyPosition.clone();
    lookAt.addScaledVector(normalDir, correction);

    return lookAt;
  }

  /**
   * Compute a positional offset that puts more screen space ahead of
   * the direction of travel ("leading space" in cinematography).
   *
   * When a subject is moving, viewers expect more space in front of
   * the subject than behind it. This computes a small camera offset
   * that achieves that by shifting the camera slightly behind the
   * direction of travel.
   *
   * @param {THREE.Vector3} velocity - ship velocity vector
   * @param {THREE.Vector3} cameraPosition - current camera position
   * @param {number} [amount=0.1] - how much leading space (0 = none, 1 = aggressive)
   * @returns {THREE.Vector3} offset vector to add to camera position
   */
  static leadingSpace(velocity, cameraPosition, amount = 0.1) {
    const speed = velocity.length();

    // No leading space if barely moving
    if (speed < 0.01) {
      return new THREE.Vector3();
    }

    // Offset the camera backward along velocity direction.
    // This shifts the ship forward in the frame, creating leading space.
    const velocityDir = _scratch1.copy(velocity).normalize();

    // Scale the offset with speed but cap it so it doesn't go wild
    // at high velocities. Max offset is `amount * 50` scene units.
    const offsetMagnitude = amount * Math.min(speed, 50);

    // Offset is OPPOSITE to velocity (camera sits behind the ship)
    return velocityDir.clone().multiplyScalar(-offsetMagnitude);
  }
}
