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
 * - Left-click-drag: orbit around target (yaw/pitch)
 * - Middle-click-drag: free-look (rotate view from fixed camera position)
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
    this.minDistance = 0.01;
    this.maxDistance = 50000;

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

    // ── Free-look (middle mouse) ──
    // When active, the camera stays in place and you rotate the view direction.
    // Works by holding the camera position fixed and moving the orbit target.
    this.isFreeLooking = false;
    this._freeLookAnchor = new THREE.Vector3(); // camera pos when free-look started

    // Callback fired when free-look ends (middle mouse released).
    // main.js uses this to clear focus state so tracking doesn't resume
    // and pull the camera back to the planet you were orbiting before.
    this.onFreeLookEnd = null;

    // ── Gyroscope ──
    this.gyroEnabled = false;
    this._prevAlpha = null;
    this._prevBeta = null;
    this._gyroSensitivity = 0.015; // radians per degree of device rotation

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

  /**
   * During free-look: keep the camera at _freeLookAnchor while yaw/pitch change.
   * Normally, camera = target + offset(yaw, pitch, distance).
   * For free-look, we solve for target: target = camera - offset.
   * This moves the orbit target so that the camera stays put.
   */
  _recomputeTargetForFreeLook() {
    const d = this.smoothedDistance;
    const cosPitch = Math.cos(this.pitch);

    // offset = the vector from target to camera (same math as _applyOrbit)
    const offsetX = d * Math.sin(this.yaw) * cosPitch;
    const offsetY = d * Math.sin(this.pitch);
    const offsetZ = d * Math.cos(this.yaw) * cosPitch;

    // target = anchor - offset
    this.target.set(
      this._freeLookAnchor.x - offsetX,
      this._freeLookAnchor.y - offsetY,
      this._freeLookAnchor.z - offsetZ,
    );
    this._targetGoal.copy(this.target);
    this._transitioning = false;

    // Snap smoothed values so there's no lag during free-look
    this.smoothedYaw = this.yaw;
    this.smoothedPitch = this.pitch;
  }

  _setupListeners() {
    // ── Mouse controls ──
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        // Left click: start orbiting
        this.isDragging = true;
        this.autoRotateActive = false;
      } else if (e.button === 1) {
        // Middle click: start free-look (rotate view from fixed position)
        e.preventDefault();
        this.isFreeLooking = true;
        this.autoRotateActive = false;
        this._freeLookAnchor.copy(this.camera.position);
      }
    });

    // Prevent browser default middle-click behavior (auto-scroll, paste menu)
    this.canvas.addEventListener('auxclick', (e) => {
      if (e.button === 1) e.preventDefault();
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) {
        this.isDragging = false;
      } else if (e.button === 1) {
        this.isFreeLooking = false;
        // Tell main.js to clear focus state so the camera stays here
        // orbiting the point we were looking at, instead of snapping
        // back to the planet we were focused on before free-look.
        if (this.onFreeLookEnd) this.onFreeLookEnd();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isFreeLooking) {
        // Free-look: adjust yaw/pitch, keep camera position fixed by
        // recomputing the orbit target. This makes you "look around"
        // from wherever the camera currently is.
        this.yaw -= e.movementX * this.dragSensitivity;
        this.pitch += e.movementY * this.dragSensitivity;
        const limit = (85 * Math.PI) / 180;
        this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
        this._recomputeTargetForFreeLook();
        return;
      }

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
      if (e.touches.length === 1 && this.isDragging && !this.gyroEnabled) {
        // Single finger: orbit (disabled when gyro is active)
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

    // ── Gyroscope ──
    this._gyroHandler = (e) => {
      if (!this.gyroEnabled) return;
      if (e.alpha === null || e.beta === null) return;

      if (this._prevAlpha !== null) {
        // Alpha = compass heading (0-360), wraps around
        let dAlpha = e.alpha - this._prevAlpha;
        if (dAlpha > 180) dAlpha -= 360;
        if (dAlpha < -180) dAlpha += 360;

        // Beta = front-back tilt (-180 to 180)
        let dBeta = e.beta - this._prevBeta;
        if (dBeta > 180) dBeta -= 360;
        if (dBeta < -180) dBeta += 360;

        // Alpha → yaw (turning phone left/right), Beta → pitch (tilting up/down)
        this.yaw -= dAlpha * this._gyroSensitivity;
        this.pitch -= dBeta * this._gyroSensitivity;
        const limit = (85 * Math.PI) / 180;
        this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
      }

      this._prevAlpha = e.alpha;
      this._prevBeta = e.beta;
    };
  }

  /**
   * Enable gyroscope control. Returns a promise that resolves to true/false
   * depending on whether permission was granted (needed on iOS 13+).
   */
  async enableGyro() {
    // iOS 13+ requires permission from a user gesture
    if (typeof DeviceOrientationEvent !== 'undefined' &&
        typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const perm = await DeviceOrientationEvent.requestPermission();
        if (perm !== 'granted') return false;
      } catch {
        return false;
      }
    }

    this.gyroEnabled = true;
    this._prevAlpha = null;
    this._prevBeta = null;
    this.autoRotateActive = false;
    window.addEventListener('deviceorientation', this._gyroHandler);
    return true;
  }

  disableGyro() {
    this.gyroEnabled = false;
    this._prevAlpha = null;
    this._prevBeta = null;
    window.removeEventListener('deviceorientation', this._gyroHandler);
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
   * Focus on a new position at a comfortable viewing distance.
   *
   * "Teleport & zoom-in": snaps the target position instantly (no empty-space
   * flight between planets thousands of units apart), but starts the camera
   * 10x farther out. The log-space distance smoothing then zooms in over ~1s,
   * giving a cinematic "arriving at a planet" feel.
   */
  focusOn(position, viewDistance = 8) {
    this._targetGoal.copy(position);
    this.target.copy(position);
    this.distance = viewDistance;
    // Start 10x farther out — planet is visible as a small dot, then zoom in.
    // Log-space smoothing makes the zoom feel natural (~1s to settle).
    this.smoothedDistance = viewDistance * 10;
    // Kill residual scroll momentum so it doesn't fight the zoom-in
    this.zoomSpeed = 0;
    this._transitioning = false;
  }

  /**
   * Update the target position for a moving object (called every frame).
   * Unlike focusOn(), this doesn't touch zoom distance.
   */
  trackTarget(position) {
    // Snap both target and goal directly to the body's current position.
    // At realistic scale, planets orbit at enormous linear velocities
    // (angular_speed × orbitRadiusScene). A slow lerp (4% per frame) can
    // never keep up — it creates a permanent offset between where the
    // camera orbits and where the planet actually is. Direct copy keeps
    // the camera locked on.
    this._targetGoal.copy(position);
    this.target.copy(position);
    this._transitioning = false;
  }

  /**
   * Zoom out to see the whole system (target the center).
   * Snaps position and distance — orbit lines give immediate visual context.
   */
  viewSystem(systemRadius) {
    this._targetGoal.set(0, 0, 0);
    this.target.set(0, 0, 0);
    this.distance = systemRadius * 1.5;
    this.smoothedDistance = systemRadius * 1.5;
    this.zoomSpeed = 0;
    this._transitioning = false;
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

    // Distance uses log-space interpolation — perceptually linear zoom
    // across huge scale changes (e.g., overview at 45000 → planet at 0.26).
    // Linear lerp would spend 2+ seconds too far away to see anything.
    const logSmoothed = Math.log(this.smoothedDistance);
    const logTarget = Math.log(this.distance);
    this.smoothedDistance = Math.exp(logSmoothed + (logTarget - logSmoothed) * factor);

    this._applyOrbit();
  }
}
