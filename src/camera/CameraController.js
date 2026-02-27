import * as THREE from 'three';

/**
 * Orbit camera controller — the camera always orbits around a target point
 * (the planet), like a satellite circling it.
 *
 * 1. Auto-drift: camera slowly orbits on its own (screensaver mode).
 *    Stops permanently once you click-drag.
 * 2. Click-drag: orbit around the planet (yaw = horizontal, pitch = vertical).
 * 3. Scroll wheel: zoom in/out (change orbit distance).
 */
export class CameraController {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;

    // ── Target (what we orbit around) ──
    this.target = new THREE.Vector3(0, 0, 0);

    // ── Orbit angles (spherical coordinates around target) ──
    this.yaw = 0;           // horizontal angle
    this.pitch = 0.15;      // slight upward view to start

    // ── Orbit distance ──
    this.distance = 8;      // current distance from target
    this.minDistance = 0.5;  // allow close-up views of planet surface
    this.maxDistance = 30;

    // ── Click-drag state ──
    this.isDragging = false;
    this.dragSensitivity = 0.003;

    // ── Auto-drift ──
    this.autoRotateSpeed = 2;          // degrees per second
    this.autoRotateActive = true;      // stops permanently after first drag

    // ── Zoom (scroll wheel) ──
    this.zoomSpeed = 0;                // current zoom velocity
    this.zoomDamping = 0.88;           // friction
    this.scrollSensitivity = 1.5;      // how much each scroll tick accelerates

    // ── Smoothing ──
    this.smoothedYaw = this.yaw;
    this.smoothedPitch = this.pitch;
    this.smoothedDistance = this.distance;
    this.smoothing = 0.08;

    this._setupListeners();

    // Set initial camera position so the first frame isn't inside the planet
    this._applyOrbit();
  }

  /** Position the camera from current smoothed orbit values and look at target */
  _applyOrbit() {
    const d = this.smoothedDistance;
    const cosPitch = Math.cos(this.smoothedPitch);
    this.camera.position.set(
      this.target.x + d * Math.sin(this.smoothedYaw) * cosPitch,
      this.target.y + d * Math.sin(this.smoothedPitch),
      this.target.z + d * Math.cos(this.smoothedYaw) * cosPitch,
    );
    this.camera.lookAt(this.target);
  }

  _setupListeners() {
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isDragging = true;
        this.autoRotateActive = false;
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isDragging = false;
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;

      this.yaw -= e.movementX * this.dragSensitivity;
      this.pitch += e.movementY * this.dragSensitivity;

      // Clamp pitch so camera can't flip over the poles
      const limit = (85 * Math.PI) / 180;
      this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    });

    // Scroll wheel: zoom in/out
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      // Scroll up = zoom in (reduce distance)
      this.zoomSpeed += Math.sign(e.deltaY) * this.scrollSensitivity;
    }, { passive: false });
  }

  /**
   * Set the orbit target (e.g., when spawning a new planet).
   */
  setTarget(position) {
    this.target.copy(position);
  }

  /**
   * Smoothly re-center on a new position (same as setTarget for orbit cam).
   */
  centerOn(worldPosition) {
    this.target.copy(worldPosition);
  }

  update(deltaTime) {
    // Auto-drift: slowly orbit around the target
    if (this.autoRotateActive && !this.isDragging) {
      this.yaw += this.autoRotateSpeed * (Math.PI / 180) * deltaTime;
    }

    // Apply zoom velocity to distance
    if (Math.abs(this.zoomSpeed) > 0.001) {
      this.distance += this.zoomSpeed * deltaTime;
      this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
      this.zoomSpeed *= Math.pow(this.zoomDamping, deltaTime * 60);
    }

    // Smooth interpolation (frame-rate independent)
    const factor = 1 - Math.pow(1 - this.smoothing, deltaTime * 60);
    this.smoothedYaw += (this.yaw - this.smoothedYaw) * factor;
    this.smoothedPitch += (this.pitch - this.smoothedPitch) * factor;
    this.smoothedDistance += (this.distance - this.smoothedDistance) * factor;

    this._applyOrbit();
  }
}
