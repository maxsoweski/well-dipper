/**
 * ShipCameraSystem — coordinator that wires FlightDynamics + CinematicDirector
 * into main.js, replacing CameraController.
 *
 * This presents the same API surface that main.js expects from CameraController
 * so the swap is mostly mechanical: change the import and constructor call.
 *
 * Internally it delegates to:
 *   - GravityField: body positions, SOI queries, gravity acceleration
 *   - FlightDynamics: ship position/velocity, gravity integration, state machine
 *   - CinematicDirector: camera framing, composition, look-at target
 *
 * For situations where the gravity system isn't available (deep sky, gallery,
 * title screen), it falls back to a simple orbit mode that mimics
 * CameraController's basic orbit behavior.
 *
 * Input handling (mouse drag, scroll, touch, WASD, gyro) is built into this
 * class, matching CameraController's behavior but routing through the new
 * physics pipeline.
 */

import * as THREE from 'three';
import { GravityField } from '../physics/GravityField.js';
import { FlightDynamics } from '../flight/FlightDynamics.js';
import { FlightState } from '../flight/FlightStates.js';
import { CinematicDirector, CompositionState } from './CinematicDirector.js';

// Reusable scratch vectors
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();

export class ShipCameraSystem {
  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;

    // ── Gravity subsystem (null until a star system is spawned) ──
    this.gravityField = null;
    this.flight = null;
    this.director = null;

    // ── Orbit state (simple fallback when gravity is not available) ──
    this.target = new THREE.Vector3(0, 0, 0);
    this._targetGoal = new THREE.Vector3(0, 0, 0);
    this._transitioning = false;
    this._transitionSpeed = 0.06;

    this.yaw = 0;
    this.pitch = 0.15;
    this.distance = 8;
    this.minDistance = 0.01;
    this.maxDistance = 50000;

    this.smoothedYaw = this.yaw;
    this.smoothedPitch = this.pitch;
    this.smoothedDistance = this.distance;
    this.smoothing = 0.08;

    // ── Zoom ──
    this.zoomSpeed = 0;
    this.zoomDamping = 0.88;
    this.scrollSensitivity = 1.5;

    // ── Drag input ──
    this.isDragging = false;
    this.dragSensitivity = 0.003;

    // ── Auto-drift ──
    this.autoRotateSpeed = 0.67;
    this.autoRotateActive = true;

    // ── Free-look ──
    this.isFreeLooking = false;
    this._freeLookAnchor = new THREE.Vector3();
    this._freeLookTrackPos = new THREE.Vector3();
    this._freeLookTracking = false;
    this._savedYaw = 0;
    this._savedPitch = 0;

    // ── Return-to-orbit (after free-look) ──
    this._returningToOrbit = false;
    this._returnDelay = 0;
    this._returnTurning = false;
    this._returnTracking = false;
    this._returnTrackPos = new THREE.Vector3();
    this._returnLookTarget = new THREE.Vector3();
    this._returnMatrix = new THREE.Matrix4();
    this._returnQuat = new THREE.Quaternion();

    // ── Bypass mode (for FlythroughCamera / autopilot) ──
    this.bypassed = false;

    // ── Force free-look (deep sky) ──
    this.forceFreeLook = false;
    this._leftFreeLooking = false;

    // ── WASD free-flight ──
    this._flightVelocity = new THREE.Vector3();
    this._flightInput = new THREE.Vector3();
    this._flightThrust = 15;
    this._flightBoostMult = 3;
    this._flightDrag = 3;
    this._flightMaxSpeed = 30;
    this._flightBoosting = false;
    this._flightActive = false;
    this._flightEnabled = true;
    this._flightFreeLook = false;

    // ── Gyroscope ──
    this.gyroEnabled = false;
    this._prevAlpha = null;
    this._prevBeta = null;
    this._prevGamma = null;
    this._gyroSensitivity = 0.015;

    // ── Callbacks (set by main.js) ──
    this.onFreeLookEnd = null;
    this.hasFocusedBody = null;

    // ── Touch state ──
    this._lastTouchX = 0;
    this._lastTouchY = 0;
    this._lastPinchDist = 0;
    this._touchCount = 0;

    // ── Whether gravity-driven mode is active ──
    this._gravityMode = false;

    this._setupListeners();
    this._applyOrbit();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  GRAVITY SYSTEM LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Initialize the gravity subsystem for a new star system.
   * Call after spawnSystem() creates meshes.
   *
   * @param {object} systemData - output of StarSystemGenerator.generate()
   * @param {object} bodyMeshes - { star, star2?, planets: [], moons: [][] }
   */
  initGravity(systemData, bodyMeshes) {
    try {
      this.gravityField = new GravityField(systemData, bodyMeshes);
      this.flight = new FlightDynamics(this.gravityField, {
        thrustForce: 40,
        dragCoefficient: 0.02,
        maxSpeed: 500,
      });
      this.director = new CinematicDirector(this.camera, this.gravityField);
      this._gravityMode = true;

      // Sync flight position with current camera position
      this.flight.position.copy(this.camera.position);
      this.flight.velocity.set(0, 0, 0);
    } catch (e) {
      console.warn('ShipCameraSystem: gravity init failed, using orbit mode', e);
      this._gravityMode = false;
      this.gravityField = null;
      this.flight = null;
      this.director = null;
    }
  }

  /**
   * Tear down the gravity subsystem (e.g., when switching to deep sky).
   */
  clearGravity() {
    this._gravityMode = false;
    this.gravityField = null;
    this.flight = null;
    this.director = null;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ORBIT MATH (fallback mode — matches CameraController exactly)
  // ═══════════════════════════════════════════════════════════════════

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

  _recomputeTargetForFreeLook() {
    const d = this.smoothedDistance;
    const cosPitch = Math.cos(this.pitch);
    const offsetX = d * Math.sin(this.yaw) * cosPitch;
    const offsetY = d * Math.sin(this.pitch);
    const offsetZ = d * Math.cos(this.yaw) * cosPitch;
    this.target.set(
      this._freeLookAnchor.x - offsetX,
      this._freeLookAnchor.y - offsetY,
      this._freeLookAnchor.z - offsetZ,
    );
    this._targetGoal.copy(this.target);
    this._transitioning = false;
    this.smoothedYaw = this.yaw;
    this.smoothedPitch = this.pitch;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PUBLIC API (CameraController-compatible)
  // ═══════════════════════════════════════════════════════════════════

  setTarget(position) {
    this.target.copy(position);
    this._targetGoal.copy(position);
    this._transitioning = false;
    this._returningToOrbit = false;
  }

  focusOn(position, viewDistance = 8) {
    this.target.copy(position);
    this._targetGoal.copy(position);
    this._transitioning = false;
    this._returningToOrbit = false;

    const dx = this.camera.position.x - position.x;
    const dy = this.camera.position.y - position.y;
    const dz = this.camera.position.z - position.z;
    const horizDist = Math.sqrt(dx * dx + dz * dz);
    this.yaw = Math.atan2(dx, dz);
    this.smoothedYaw = this.yaw;
    // Derive pitch from current camera position relative to body (no snap)
    this.pitch = Math.atan2(dy, horizDist);
    this.smoothedPitch = this.pitch;
    this.distance = viewDistance;
    this.smoothedDistance = viewDistance; // snap — no lerp blip on arrival
    this.zoomSpeed = 0;

    // If gravity mode is active, also position the flight system
    if (this._gravityMode && this.flight) {
      // Compute where the camera will be after orbit is applied
      const d = viewDistance;
      const cosPitch = Math.cos(this.pitch);
      _v1.set(
        position.x + d * Math.sin(this.yaw) * cosPitch,
        position.y + d * Math.sin(this.pitch),
        position.z + d * Math.cos(this.yaw) * cosPitch,
      );
      this.flight.setPositionVelocity(_v1);
    }
  }

  viewSystem(systemRadius) {
    this.target.set(0, 0, 0);
    this._targetGoal.set(0, 0, 0);
    this._transitioning = false;
    this._returningToOrbit = false;
    this.distance = systemRadius * 1.5;
    this.zoomSpeed = 0;

    if (this._gravityMode && this.flight) {
      const d = this.distance;
      const cosPitch = Math.cos(this.pitch);
      _v1.set(
        d * Math.sin(this.yaw) * cosPitch,
        d * Math.sin(this.pitch),
        d * Math.cos(this.yaw) * cosPitch,
      );
      this.flight.setPositionVelocity(_v1);
    }
  }

  trackTarget(position) {
    this._targetGoal.copy(position);

    if (this._returningToOrbit) {
      this._returnLookTarget.copy(position);
      if (!this._returnTracking) {
        this._returnTrackPos.copy(position);
        this._returnTracking = true;
      } else {
        const dx = position.x - this._returnTrackPos.x;
        const dy = position.y - this._returnTrackPos.y;
        const dz = position.z - this._returnTrackPos.z;
        this.camera.position.x += dx;
        this.camera.position.y += dy;
        this.camera.position.z += dz;
        this._returnTrackPos.copy(position);
      }
    } else if (!this._transitioning) {
      this.target.copy(position);
    }
  }

  trackFreeLookAnchor(bodyPosition) {
    if (!this.isFreeLooking) return;
    if (!this._freeLookTracking) {
      this._freeLookTrackPos.copy(bodyPosition);
      this._freeLookTracking = true;
      return;
    }
    this._freeLookAnchor.x += bodyPosition.x - this._freeLookTrackPos.x;
    this._freeLookAnchor.y += bodyPosition.y - this._freeLookTrackPos.y;
    this._freeLookAnchor.z += bodyPosition.z - this._freeLookTrackPos.z;
    this._freeLookTrackPos.copy(bodyPosition);
    this._recomputeTargetForFreeLook();
  }

  enterFreeLook() {
    if (this._returningToOrbit) {
      this._returningToOrbit = false;
      this._returnTurning = false;
      this._returnTracking = false;
      const fwd = new THREE.Vector3();
      this.camera.getWorldDirection(fwd);
      this.pitch = Math.asin(Math.max(-1, Math.min(1, -fwd.y)));
      const cp = Math.cos(this.pitch);
      if (Math.abs(cp) > 0.001) {
        this.yaw = Math.atan2(-fwd.x / cp, -fwd.z / cp);
      }
      this.smoothedYaw = this.yaw;
      this.smoothedPitch = this.pitch;
      const dist = this.camera.position.distanceTo(this._returnLookTarget);
      this.distance = dist;
      this.smoothedDistance = dist;
    }
    this.isFreeLooking = true;
    this._freeLookAnchor.copy(this.camera.position);
    this._freeLookTracking = false;
    this.autoRotateActive = false;
    this._savedYaw = this.yaw;
    this._savedPitch = this.pitch;
    this._recomputeTargetForFreeLook();
  }

  exitFreeLook(resumeOrbit = false) {
    this.isFreeLooking = false;
    this._freeLookTracking = false;
    this.smoothedYaw = this.yaw;
    this.smoothedPitch = this.pitch;

    if (resumeOrbit) {
      this._returningToOrbit = true;
      this._returnDelay = 2.0;
      this._returnTurning = false;
      this._returnTracking = false;
    } else {
      this._targetGoal.copy(this.target);
      this._transitioning = false;
      if (this.onFreeLookEnd) this.onFreeLookEnd();
    }
  }

  restoreFromWorldState(targetPosition) {
    this.bypassed = false;
    this.target.copy(targetPosition);
    this._targetGoal.copy(targetPosition);
    this._transitioning = false;

    const offset = this.camera.position.clone().sub(targetPosition);
    const dist = offset.length();
    const yaw = Math.atan2(offset.x, offset.z);
    const pitch = Math.asin(Math.max(-1, Math.min(1, offset.y / dist)));

    this.yaw = yaw;
    this.pitch = pitch;
    this.distance = dist;
    this.smoothedYaw = yaw;
    this.smoothedPitch = pitch;
    this.smoothedDistance = dist;
    this.zoomSpeed = 0;

    if (this._gravityMode && this.flight) {
      this.flight.setPositionVelocity(this.camera.position.clone());
    }
  }

  // ── WASD free-flight ──

  setFlightInput(forward, right, boost) {
    const hadInput = this._flightInput.lengthSq() > 0;
    const hasInput = (forward !== 0 || right !== 0);

    this._flightInput.set(right, 0, -forward);
    this._flightBoosting = boost;
    this._flightActive = hasInput || this._flightVelocity.lengthSq() > 0.0001;

    if (hasInput && !hadInput && !this.isFreeLooking) {
      this._flightFreeLook = true;
      this.enterFreeLook();
    }
  }

  get isFlying() {
    return this._flightVelocity.lengthSq() > 0.0001;
  }

  killFlightVelocity() {
    this._flightVelocity.set(0, 0, 0);
    this._flightInput.set(0, 0, 0);
    this._flightActive = false;
    if (this._flightFreeLook) {
      this._flightFreeLook = false;
      this.exitFreeLook(false);
    }
  }

  // ── Gyroscope ──

  async enableGyro() {
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
    this._prevGamma = null;
    this.enterFreeLook();
    window.addEventListener('deviceorientation', this._gyroHandler);
    return true;
  }

  disableGyro() {
    this.gyroEnabled = false;
    this._prevAlpha = null;
    this._prevBeta = null;
    this._prevGamma = null;
    window.removeEventListener('deviceorientation', this._gyroHandler);
    const hasFocus = this.hasFocusedBody ? this.hasFocusedBody() : false;
    this.exitFreeLook(hasFocus);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MAIN UPDATE
  // ═══════════════════════════════════════════════════════════════════

  update(deltaTime) {
    if (this.bypassed) return;

    // Tick gravity field (update body positions from meshes)
    if (this._gravityMode && this.gravityField) {
      this.gravityField.tick();
    }

    // Auto-drift
    if (this.autoRotateActive && !this.isDragging) {
      this.yaw += this.autoRotateSpeed * (Math.PI / 180) * deltaTime;
    }

    // Zoom
    if (Math.abs(this.zoomSpeed) > 0.001) {
      this.distance *= Math.exp(this.zoomSpeed * deltaTime * 0.3);
      this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
      this.zoomSpeed *= Math.pow(this.zoomDamping, deltaTime * 60);
    }

    // Return-to-orbit slerp
    if (this._returningToOrbit) {
      if (this._returnDelay > 0) {
        this._returnDelay -= deltaTime;
        if (this._returnDelay <= 0) {
          this._returnTurning = true;
        }
      }
      if (this._returnTurning) {
        this._returnMatrix.lookAt(this.camera.position, this._returnLookTarget, this.camera.up);
        this._returnQuat.setFromRotationMatrix(this._returnMatrix);
        const slerpSpeed = 1 - Math.exp(-1.5 * deltaTime);
        this.camera.quaternion.slerp(this._returnQuat, slerpSpeed);
        const dot = this.camera.quaternion.dot(this._returnQuat);
        if (dot > 0.9995) {
          this._returningToOrbit = false;
          this._returnTurning = false;
          this._returnTracking = false;
          this.restoreFromWorldState(this._returnLookTarget);
        }
      }
      return;
    }

    // Smooth target transition
    if (this._transitioning) {
      const factor = 1 - Math.pow(1 - this._transitionSpeed, deltaTime * 60);
      this.target.lerp(this._targetGoal, factor);
      if (this.target.distanceTo(this._targetGoal) < 0.01) {
        this.target.copy(this._targetGoal);
        this._transitioning = false;
      }
    }

    // Frame-rate independent smoothing
    const factor = 1 - Math.pow(1 - this.smoothing, deltaTime * 60);
    let yawDiff = this.yaw - this.smoothedYaw;
    yawDiff = yawDiff - Math.PI * 2 * Math.round(yawDiff / (Math.PI * 2));
    this.smoothedYaw += yawDiff * factor;
    this.smoothedPitch += (this.pitch - this.smoothedPitch) * factor;
    const logSmoothed = Math.log(this.smoothedDistance);
    const logTarget = Math.log(this.distance);
    this.smoothedDistance = Math.exp(logSmoothed + (logTarget - logSmoothed) * factor);

    // WASD free-flight physics
    if (this._flightEnabled && (this._flightActive || this._flightVelocity.lengthSq() > 0.0001)) {
      const distScale = Math.max(0.1, this.smoothedDistance * 0.5);
      const boostMult = this._flightBoosting ? this._flightBoostMult : 1;
      const thrust = this._flightThrust * distScale * boostMult;
      const maxSpd = this._flightMaxSpeed * distScale * boostMult;

      if (this._flightInput.lengthSq() > 0) {
        const fwd = new THREE.Vector3();
        this.camera.getWorldDirection(fwd);
        fwd.y = 0;
        fwd.normalize();
        const right = new THREE.Vector3();
        right.crossVectors(fwd, this.camera.up).normalize();
        const accel = new THREE.Vector3();
        accel.addScaledVector(fwd, -this._flightInput.z);
        accel.addScaledVector(right, this._flightInput.x);
        accel.normalize();
        this._flightVelocity.addScaledVector(accel, thrust * deltaTime);
      }

      const dragFactor = Math.exp(-this._flightDrag * deltaTime);
      this._flightVelocity.multiplyScalar(dragFactor);
      const speed = this._flightVelocity.length();
      if (speed > maxSpd) {
        this._flightVelocity.multiplyScalar(maxSpd / speed);
      }

      if (speed > 0.0001) {
        const displacement = this._flightVelocity.clone().multiplyScalar(deltaTime);
        this.target.add(displacement);
        this._targetGoal.add(displacement);
      }

      const wasFlying = this._flightActive;
      this._flightActive = this._flightInput.lengthSq() > 0
                         || this._flightVelocity.lengthSq() > 0.0001;
      if (wasFlying && !this._flightActive && this._flightFreeLook) {
        this._flightFreeLook = false;
        this.exitFreeLook(false);
      }
    }

    // Apply orbit positioning
    this._applyOrbit();

    // Update FlightDynamics + CinematicDirector if gravity mode is active
    if (this._gravityMode && this.flight && this.director) {
      // Sync flight position from camera (orbit mode drives camera position)
      this.flight.position.copy(this.camera.position);

      // Update flight dynamics (gravity integration, state detection)
      this.flight.update(deltaTime);

      // Update cinematic director
      this.director.update(
        deltaTime,
        this.flight.position,
        this.flight.velocity,
        this.flight.state,
        {
          orbitBodyIndex: this.flight._orbitBodyIndex,
          approachBodyIndex: this.flight._approachBodyIndex,
          lastGravResult: this.flight.lastGravResult,
        }
      );
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  INPUT HANDLING
  // ═══════════════════════════════════════════════════════════════════

  _setupListeners() {
    // ── Mouse controls ──
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.forceFreeLook) {
        if (this.bypassed) return;
        this.enterFreeLook();
        this._leftFreeLooking = true;
      } else if (e.button === 0) {
        this.isDragging = true;
        this.autoRotateActive = false;
        if (this._returningToOrbit) {
          this._returningToOrbit = false;
          this._returnTurning = false;
          this._returnTracking = false;
          this.restoreFromWorldState(this._returnLookTarget);
        }
      } else if (e.button === 1) {
        if (this.bypassed) return;
        e.preventDefault();
        this.enterFreeLook();
      }
    });

    this.canvas.addEventListener('auxclick', (e) => {
      if (e.button === 1) e.preventDefault();
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0 && this._leftFreeLooking) {
        this._leftFreeLooking = false;
        const hasFocus = this.hasFocusedBody ? this.hasFocusedBody() : false;
        this.exitFreeLook(hasFocus);
      } else if (e.button === 0) {
        this.isDragging = false;
      } else if (e.button === 1) {
        const hasFocus = this.hasFocusedBody ? this.hasFocusedBody() : false;
        this.exitFreeLook(hasFocus);
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isFreeLooking) {
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
        let dAlpha = e.alpha - this._prevAlpha;
        if (dAlpha > 180) dAlpha -= 360;
        if (dAlpha < -180) dAlpha += 360;
        let dBeta = e.beta - this._prevBeta;
        if (dBeta > 180) dBeta -= 360;
        if (dBeta < -180) dBeta += 360;
        let dGamma = (e.gamma || 0) - (this._prevGamma || 0);
        if (dGamma > 90) dGamma -= 180;
        if (dGamma < -90) dGamma += 180;

        const angle = window.screen?.orientation?.angle ?? 0;
        let dYaw, dPitch;
        if (angle === 0 || angle === 180) {
          const sign = angle === 0 ? 1 : -1;
          dYaw = -dGamma * sign;
          dPitch = -dBeta * sign;
        } else {
          const sign = angle === 90 ? 1 : -1;
          dYaw = -dAlpha * sign;
          dPitch = -dBeta * sign;
        }

        this.yaw += dYaw * this._gyroSensitivity;
        this.pitch += dPitch * this._gyroSensitivity;
        const limit = (85 * Math.PI) / 180;
        this.pitch = Math.max(-limit, Math.min(limit, this.pitch));

        if (this.isFreeLooking) {
          this._recomputeTargetForFreeLook();
        }
      }

      this._prevAlpha = e.alpha;
      this._prevBeta = e.beta;
      this._prevGamma = e.gamma;
    };
  }
}
