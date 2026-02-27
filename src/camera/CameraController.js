import * as THREE from 'three';

/**
 * Orbit camera controller — orbits around a target point.
 *
 * Supports two scales:
 * 1. System overview: zoomed out to see all planets (~distance 100-400)
 * 2. Planet focus: zoomed in on a single planet (~distance 3-15)
 *
 * Target switching is smoothly animated via lerp.
 *
 * Controls:
 * - Click-drag: orbit around target (yaw/pitch)
 * - Scroll wheel: zoom in/out
 * - Auto-drift: slow rotation when idle (stops after first drag)
 */
export class CameraController {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;

    // ── Target (what we orbit around) ──
    this.target = new THREE.Vector3(0, 0, 0);
    this._targetGoal = new THREE.Vector3(0, 0, 0); // for smooth transitions

    // ── Orbit angles (spherical coordinates around target) ──
    this.yaw = 0;
    this.pitch = 0.15;

    // ── Orbit distance ──
    this.distance = 8;
    this.minDistance = 0.5;
    this.maxDistance = 2000;

    // ── Click-drag state ──
    this.isDragging = false;
    this.dragSensitivity = 0.003;

    // ── Auto-drift ──
    this.autoRotateSpeed = 0.67;        // degrees per second
    this.autoRotateActive = true;

    // ── Zoom (scroll wheel) ──
    this.zoomSpeed = 0;
    this.zoomDamping = 0.88;
    this.scrollSensitivity = 1.5;

    // ── Smoothing ──
    this.smoothedYaw = this.yaw;
    this.smoothedPitch = this.pitch;
    this.smoothedDistance = this.distance;
    this.smoothing = 0.08;

    // ── Target transition ──
    this._transitioning = false;
    this._transitionSpeed = 0.04; // lerp factor per frame at 60fps

    this._setupListeners();
    this._applyOrbit();
  }

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
    // ── Mouse controls ──
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
      const limit = (85 * Math.PI) / 180;
      this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomSpeed += Math.sign(e.deltaY) * this.scrollSensitivity;
    }, { passive: false });

    // ── Touch controls ──
    this._lastTouchX = 0;
    this._lastTouchY = 0;
    this._lastPinchDist = 0;
    this._touchCount = 0;

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this._touchCount = e.touches.length;
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.autoRotateActive = false;
        this._lastTouchX = e.touches[0].clientX;
        this._lastTouchY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        this.isDragging = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        this._lastPinchDist = Math.sqrt(dx * dx + dy * dy);
      }
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && this.isDragging) {
        // Single finger: orbit
        const x = e.touches[0].clientX;
        const y = e.touches[0].clientY;
        const dx = x - this._lastTouchX;
        const dy = y - this._lastTouchY;
        this.yaw -= dx * this.dragSensitivity;
        this.pitch += dy * this.dragSensitivity;
        const limit = (85 * Math.PI) / 180;
        this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
        this._lastTouchX = x;
        this._lastTouchY = y;
      } else if (e.touches.length === 2) {
        // Pinch: zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (this._lastPinchDist > 0) {
          const scale = this._lastPinchDist / dist;
          this.distance *= scale;
          this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
        }
        this._lastPinchDist = dist;
      }
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.isDragging = false;
      this._lastPinchDist = 0;
      this._touchCount = e.touches.length;
    }, { passive: false });
  }

  /**
   * Set the orbit target instantly (no animation).
   */
  setTarget(position) {
    this.target.copy(position);
    this._targetGoal.copy(position);
    this._transitioning = false;
  }

  /**
   * Smoothly transition the orbit target to a new position.
   * Also sets a comfortable viewing distance.
   */
  focusOn(position, viewDistance = 8) {
    this._targetGoal.copy(position);
    this.distance = viewDistance;
    this._transitioning = true;
  }

  /**
   * Update the target position for a moving object (called every frame).
   * Unlike focusOn(), this doesn't touch zoom distance.
   */
  trackTarget(position) {
    this._targetGoal.copy(position);
    // Keep transitioning so the camera lerps toward the moving target
    if (!this._transitioning) {
      this._transitioning = true;
    }
  }

  /**
   * Zoom out to see the whole system (target the center).
   */
  viewSystem(systemRadius) {
    this._targetGoal.set(0, 0, 0);
    this.distance = systemRadius * 1.5;
    this._transitioning = true;
  }

  update(deltaTime) {
    // Auto-drift
    if (this.autoRotateActive && !this.isDragging) {
      this.yaw += this.autoRotateSpeed * (Math.PI / 180) * deltaTime;
    }

    // Exponential zoom — scroll speed scales with current distance
    // At distance 5, a tick moves you ~0.5. At distance 500, it moves you ~50.
    if (Math.abs(this.zoomSpeed) > 0.001) {
      this.distance *= Math.exp(this.zoomSpeed * deltaTime * 0.3);
      this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
      this.zoomSpeed *= Math.pow(this.zoomDamping, deltaTime * 60);
    }

    // Smooth target transition
    if (this._transitioning) {
      const factor = 1 - Math.pow(1 - this._transitionSpeed, deltaTime * 60);
      this.target.lerp(this._targetGoal, factor);
      // Snap when close enough
      if (this.target.distanceTo(this._targetGoal) < 0.01) {
        this.target.copy(this._targetGoal);
        this._transitioning = false;
      }
    }

    // Smooth interpolation (frame-rate independent)
    const factor = 1 - Math.pow(1 - this.smoothing, deltaTime * 60);

    // Yaw uses shortest-arc interpolation to avoid spinning the long way around
    let yawDiff = this.yaw - this.smoothedYaw;
    // Normalize to [-PI, PI]
    yawDiff = yawDiff - Math.PI * 2 * Math.round(yawDiff / (Math.PI * 2));
    this.smoothedYaw += yawDiff * factor;

    this.smoothedPitch += (this.pitch - this.smoothedPitch) * factor;
    this.smoothedDistance += (this.distance - this.smoothedDistance) * factor;

    this._applyOrbit();
  }
}
