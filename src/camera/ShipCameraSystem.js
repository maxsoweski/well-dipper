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
const _v3 = new THREE.Vector3();
const _v4 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _prevQuat = new THREE.Quaternion();

// ═══════════════════════════════════════════════════════════════════
//  CAMERA MODES
// ═══════════════════════════════════════════════════════════════════
//
// TOY_BOX — orbit a focused body. Mouse drag spins, scroll zooms.
//           Legacy _applyOrbit() math. Default for screensaver MVP.
//           Mobile is always TOY_BOX. Deep sky scenes force TOY_BOX.
//
// FLIGHT  — FlightDynamics drives ship through gravity field.
//           CinematicDirector composes the shot. Mouse drag adds a
//           decaying look offset, scroll adjusts chase distance,
//           WASD thrusts. Requires gravity subsystem.
//
// Mode is persisted in localStorage under STORAGE_KEY, restored on
// boot unless mobile (mobile forces TOY_BOX regardless of saved value).
//
export const CameraMode = Object.freeze({
  TOY_BOX: 'toy_box',
  FLIGHT: 'flight',
});

// Look offset tuning (Flight mode) — tweak here to adjust feel
const LOOK_OFFSET_MAX_YAW = Math.PI / 2;     // ±90° horizontal
const LOOK_OFFSET_MAX_PITCH = Math.PI / 3;   // ±60° vertical
const LOOK_OFFSET_DECAY_TAU = 2.0;           // seconds to return to center (~63%)
const LOOK_OFFSET_SNAP_THRESHOLD = 0.001;    // snap to 0 under this (rad)

// Chase distance scale bounds (Flight mode scroll wheel)
const CHASE_SCALE_MIN = 0.3;
const CHASE_SCALE_MAX = 4.0;
const CHASE_SCALE_STEP = 0.1;                // per wheel tick

const STORAGE_KEY = 'wd_cameraMode';

// ═══════════════════════════════════════════════════════════════════
//  FRAME DIAGNOSTICS — ring buffer for detecting jumps, NaN, divergence
// ═══════════════════════════════════════════════════════════════════

const DIAG_BUFFER_SIZE = 120; // 2 seconds at 60fps

class FrameDiagnostics {
  constructor() {
    this.frames = new Array(DIAG_BUFFER_SIZE);
    this.index = 0;
    this.count = 0;
    this.anomalies = [];   // recent anomalies (capped at 50)
    this._prevCamPos = new THREE.Vector3();
    this._prevCamQuat = new THREE.Quaternion();
    this._initialized = false;

    // Thresholds
    this.jumpThreshold = 100;     // scene units per frame — anything above is a teleport
    this.rotSnapThreshold = 0.95; // quat dot below this = orientation snap
    this.divergeThreshold = 50;   // flight vs camera position divergence
  }

  record(camera, flight, director, gravityMode, deltaTime, bypassed) {
    const camPos = camera.position;
    const frame = {
      t: performance.now(),
      dt: deltaTime,
      mode: bypassed ? 'BYPASSED' : (gravityMode ? 'GRAVITY' : 'ORBIT'),
      camX: camPos.x, camY: camPos.y, camZ: camPos.z,
      posDelta: 0,
      quatDot: 1,
      flightState: flight ? flight.state : null,
      flightDiverge: 0,
      hasNaN: false,
      anomaly: null,
    };

    // NaN check
    if (isNaN(camPos.x) || isNaN(camPos.y) || isNaN(camPos.z)) {
      frame.hasNaN = true;
      frame.anomaly = 'NaN_POSITION';
    }

    if (this._initialized) {
      // Position delta
      frame.posDelta = Math.sqrt(
        (camPos.x - this._prevCamPos.x) ** 2 +
        (camPos.y - this._prevCamPos.y) ** 2 +
        (camPos.z - this._prevCamPos.z) ** 2
      );

      // Orientation continuity (quaternion dot product)
      frame.quatDot = Math.abs(camera.quaternion.dot(this._prevCamQuat));

      // Flight/camera divergence (gravity mode only)
      // Measures unexpected divergence: cam should be at flight.pos + director.offset
      if (gravityMode && flight && !bypassed) {
        const expectedX = flight.position.x + (director ? director._currentOffset.x : 0);
        const expectedY = flight.position.y + (director ? director._currentOffset.y : 0);
        const expectedZ = flight.position.z + (director ? director._currentOffset.z : 0);
        frame.flightDiverge = Math.sqrt(
          (camPos.x - expectedX) ** 2 +
          (camPos.y - expectedY) ** 2 +
          (camPos.z - expectedZ) ** 2
        );
      }

      // Anomaly detection
      if (!frame.anomaly) {
        if (frame.posDelta > this.jumpThreshold && frame.mode !== 'BYPASSED') {
          frame.anomaly = 'JUMP';
        } else if (frame.quatDot < this.rotSnapThreshold && frame.mode !== 'BYPASSED') {
          frame.anomaly = 'ROTATION_SNAP';
        } else if (frame.flightDiverge > this.divergeThreshold) {
          frame.anomaly = 'FLIGHT_DIVERGE';
        }
      }
    }

    // Store anomaly
    if (frame.anomaly) {
      this.anomalies.push({ ...frame, frameIndex: this.count });
      if (this.anomalies.length > 50) this.anomalies.shift();
    }

    // Save to ring buffer
    this.frames[this.index] = frame;
    this.index = (this.index + 1) % DIAG_BUFFER_SIZE;
    this.count++;

    // Update previous state
    this._prevCamPos.copy(camPos);
    this._prevCamQuat.copy(camera.quaternion);
    this._initialized = true;
  }

  /** Get summary for external query (e.g., from Playwright evaluate) */
  getSummary() {
    const filled = Math.min(this.count, DIAG_BUFFER_SIZE);
    if (filled === 0) return { frames: 0, ok: true };

    let maxPosDelta = 0;
    let minQuatDot = 1;
    let maxDiverge = 0;
    let nanCount = 0;
    let jumpCount = 0;
    let snapCount = 0;
    let divergeCount = 0;
    let avgPosDelta = 0;

    for (let i = 0; i < filled; i++) {
      const f = this.frames[i];
      if (!f) continue;
      if (f.posDelta > maxPosDelta) maxPosDelta = f.posDelta;
      if (f.quatDot < minQuatDot) minQuatDot = f.quatDot;
      if (f.flightDiverge > maxDiverge) maxDiverge = f.flightDiverge;
      if (f.hasNaN) nanCount++;
      if (f.anomaly === 'JUMP') jumpCount++;
      if (f.anomaly === 'ROTATION_SNAP') snapCount++;
      if (f.anomaly === 'FLIGHT_DIVERGE') divergeCount++;
      avgPosDelta += f.posDelta;
    }
    avgPosDelta /= filled;

    return {
      frames: filled,
      totalRecorded: this.count,
      maxPosDelta: +maxPosDelta.toFixed(4),
      avgPosDelta: +avgPosDelta.toFixed(4),
      minQuatDot: +minQuatDot.toFixed(4),
      maxFlightDiverge: +maxDiverge.toFixed(4),
      nanCount,
      jumpCount,
      snapCount,
      divergeCount,
      anomalies: this.anomalies.slice(-10), // last 10
      ok: nanCount === 0 && jumpCount === 0 && snapCount === 0 && divergeCount === 0,
      currentMode: filled > 0 ? this.frames[(this.index - 1 + DIAG_BUFFER_SIZE) % DIAG_BUFFER_SIZE]?.mode : null,
    };
  }

  /** Reset all data */
  reset() {
    this.index = 0;
    this.count = 0;
    this.anomalies = [];
    this._initialized = false;
  }
}

export class ShipCameraSystem {
  /**
   * @param {THREE.Camera} camera
   * @param {HTMLCanvasElement} canvas
   * @param {object} [options]
   * @param {boolean} [options.isMobile=false] - Forces TOY_BOX, disables Flight mode
   */
  constructor(camera, canvas, options = {}) {
    this.camera = camera;
    this.canvas = canvas;
    this.isMobile = !!options.isMobile;

    // ── Gravity subsystem (null until a star system is spawned) ──
    this.gravityField = null;
    this.flight = null;
    this.director = null;
    // True iff gravity subsystem has been initialized (independent of cameraMode)
    this._hasGravity = false;

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

    // ── Camera Mode (TOY_BOX | FLIGHT) ──
    // This field is USER INTENT, not effective state. Restored from
    // localStorage on boot; mobile forces TOY_BOX regardless. The
    // effective "is flight driving the camera?" check is `isFlightMode`,
    // which also requires `_hasGravity` — so deep sky scenes render
    // Toy-Box-style while preserving the user's Flight preference for
    // when they return to a star system.
    this.cameraMode = this._loadPersistedMode();

    // ── Flight-mode look offset (decaying cinematic look-around) ──
    this._lookOffsetYaw = 0;    // rad, clamped ±LOOK_OFFSET_MAX_YAW
    this._lookOffsetPitch = 0;  // rad, clamped ±LOOK_OFFSET_MAX_PITCH

    // ── Flight-mode chase distance scale (scroll wheel in Flight) ──
    this._chaseScale = 1.0;

    // ── Mode change observers (main.js hooks HUD, autopilot gates, etc.) ──
    this.onModeChange = null;

    // ── Frame diagnostics ──
    this._diagnostics = new FrameDiagnostics();

    this._setupListeners();
    this._applyOrbit();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  CAMERA MODE CONTROL
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Switch camera mode with a smooth handoff. Preserves world-space
   * camera position/orientation — the new mode re-derives its own state
   * from the current camera so the visual is continuous.
   *
   * `cameraMode` is USER INTENT. Effective Flight state also requires
   * `_hasGravity` — the `isFlightMode` getter handles that. Calling this
   * with FLIGHT when there's no gravity still sets intent, so when the
   * player warps into a star system Flight re-engages automatically.
   *
   * Mobile is the only absolute constraint (mobile can never be Flight).
   */
  setCameraMode(mode) {
    // Mobile is hard-locked to Toy Box
    if (this.isMobile) mode = CameraMode.TOY_BOX;
    // No-op
    if (mode === this.cameraMode) return this.cameraMode;

    const prev = this.cameraMode;
    this.cameraMode = mode;

    if (mode === CameraMode.TOY_BOX) {
      // Leaving Flight → Toy Box. Derive yaw/pitch/distance from the
      // current camera→target vector so _applyOrbit picks up right where
      // the director left off. Caller is expected to call focusOn() or
      // restoreFromWorldState() afterward to bind to a specific body;
      // here we just make sure the orbit math starts sane.
      const offset = _v1.copy(this.camera.position).sub(this.target);
      const dist = offset.length();
      if (dist > 1e-6) {
        this.yaw = Math.atan2(offset.x, offset.z);
        this.pitch = Math.asin(Math.max(-1, Math.min(1, offset.y / dist)));
        this.distance = dist;
        this.smoothedYaw = this.yaw;
        this.smoothedPitch = this.pitch;
        this.smoothedDistance = dist;
      }
      this._lookOffsetYaw = 0;
      this._lookOffsetPitch = 0;
    } else {
      // Entering Flight. Sync flight position to current camera position,
      // zero velocity so you start from rest. Director will compose from
      // there on the next update tick.
      if (this.flight) {
        this.flight.position.copy(this.camera.position);
        this.flight.velocity.set(0, 0, 0);
      }
      this._chaseScale = 1.0;
      this._lookOffsetYaw = 0;
      this._lookOffsetPitch = 0;
      // Drop out of free-look if active — director owns orientation in Flight
      if (this.isFreeLooking) this.exitFreeLook(false);
    }

    this._persistMode(mode);
    if (this.onModeChange) this.onModeChange(mode, prev);
    return this.cameraMode;
  }

  /** Toggle between TOY_BOX and FLIGHT. Returns the new effective mode. */
  toggleCameraMode() {
    const next = this.cameraMode === CameraMode.FLIGHT
      ? CameraMode.TOY_BOX
      : CameraMode.FLIGHT;
    return this.setCameraMode(next);
  }

  /** True if we're currently in Flight mode AND gravity is wired up. */
  get isFlightMode() {
    return this.cameraMode === CameraMode.FLIGHT && this._hasGravity;
  }

  _loadPersistedMode() {
    if (this.isMobile) return CameraMode.TOY_BOX;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === CameraMode.FLIGHT || saved === CameraMode.TOY_BOX) return saved;
    } catch { /* private mode, quota, etc. */ }
    return CameraMode.TOY_BOX;
  }

  _persistMode(mode) {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch { /* ignore */ }
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
      this._hasGravity = true;

      // Sync flight position with current camera position
      this.flight.position.copy(this.camera.position);
      this.flight.velocity.set(0, 0, 0);

      // Run one zero-dt physics tick to populate lastGravResult (needed
      // by circularize), then auto-circularize so the ship starts in a
      // stable orbit instead of falling into the star from zero velocity.
      // Only useful if we might enter Flight mode — harmless in Toy Box.
      this.gravityField.tick();
      this.flight.update(0); // dt=0 → no movement, just queries gravity
      this.flight.circularize();
    } catch (e) {
      console.warn('ShipCameraSystem: gravity init failed', e);
      this._hasGravity = false;
      this.gravityField = null;
      this.flight = null;
      this.director = null;
      // Don't touch cameraMode — it's user intent. isFlightMode already
      // returns false without _hasGravity, so rendering falls back to
      // Toy Box automatically.
    }
  }

  /**
   * Tear down the gravity subsystem (e.g., when switching to deep sky).
   * Preserves `cameraMode` (user intent). Effective rendering falls back
   * to Toy Box because `isFlightMode` requires `_hasGravity`.
   */
  clearGravity() {
    this._hasGravity = false;
    this.gravityField = null;
    this.flight = null;
    this.director = null;
    // Reset Flight-mode transient state so it doesn't bleed if the
    // player re-enters a system with Flight as their preference.
    this._lookOffsetYaw = 0;
    this._lookOffsetPitch = 0;
    this._chaseScale = 1.0;
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

    // If gravity is wired up, also keep the flight system in sync so
    // a later switch to Flight mode starts from the right place.
    if (this._hasGravity && this.flight) {
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

    if (this._hasGravity && this.flight) {
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

    if (this._hasGravity && this.flight) {
      this.flight.setPositionVelocity(this.camera.position.clone());
    }
  }

  // ── WASD free-flight ──
  //
  // TOY_BOX: WASD is ignored. The Toy Box is for examining bodies, not
  //          flying through them. Input is silently dropped.
  // FLIGHT:  Routes forward/right thrust into FlightDynamics.thrustVector.
  //          Director owns camera orientation, so no free-look entry.

  setFlightInput(forward, right, boost) {
    // Toy Box: WASD does nothing. Keep state clean.
    if (this.cameraMode !== CameraMode.FLIGHT) {
      this._flightInput.set(0, 0, 0);
      this._flightBoosting = false;
      this._flightActive = false;
      if (this.flight) this.flight.thrustVector.set(0, 0, 0);
      return;
    }

    const hasInput = (forward !== 0 || right !== 0);
    this._flightInput.set(right, 0, -forward);
    this._flightBoosting = boost;
    this._flightActive = hasInput || (this.flight && this.flight.velocity.lengthSq() > 0.0001);

    // Flight mode requires the gravity subsystem; guard against race on boot
    if (!this._hasGravity || !this.flight) return;

    if (hasInput) {
      const boostMult = boost ? this._flightBoostMult : 1;

      // Convert camera-relative input to world-space thrust direction
      const fwd = _v1.set(0, 0, 0);
      this.camera.getWorldDirection(fwd);
      fwd.y = 0;
      fwd.normalize();
      const rt = _v2.crossVectors(fwd, this.camera.up).normalize();

      this.flight.thrustVector.set(0, 0, 0);
      this.flight.thrustVector.addScaledVector(fwd, -this._flightInput.z); // forward
      this.flight.thrustVector.addScaledVector(rt, this._flightInput.x);   // right
      this.flight.thrustVector.normalize().multiplyScalar(
        this.flight.thrustForce * boostMult
      );
    } else {
      // No input: clear thrust so drag can settle the ship
      this.flight.thrustVector.set(0, 0, 0);
    }
  }

  get isFlying() {
    if (this.isFlightMode && this.flight) {
      return this.flight.velocity.lengthSq() > 0.0001;
    }
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
    const flightMode = this.isFlightMode;

    if (this.bypassed) {
      this._diagnostics.record(
        this.camera, this.flight, this.director,
        flightMode, deltaTime, true
      );
      return;
    }

    // Tick gravity field only when Flight mode needs it. In Toy Box the
    // director/flight systems don't run, so body positions only need to
    // be queried at the moments main.js calls focusOn/trackTarget.
    if (flightMode && this.gravityField) {
      this.gravityField.tick();
    }

    // Decay flight-mode look offset back to center (no-op in Toy Box)
    if (flightMode && !this.isDragging) {
      this._decayLookOffset(deltaTime);
    }

    // Auto-drift (Toy Box only — Flight is composed by the director)
    if (!flightMode && this.autoRotateActive && !this.isDragging) {
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

    // Legacy WASD free-flight physics. This path is dead weight now that
    // WASD is ignored in Toy Box and routed to FlightDynamics in Flight.
    // Kept behind an `if (false)` guard for reference until we're sure
    // nothing else reaches it. TODO: remove after Phase 2 ships.
    if (false && !flightMode && this._flightEnabled && (this._flightActive || this._flightVelocity.lengthSq() > 0.0001)) {
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

    if (flightMode) {
      // ── FLIGHT MODE: flight dynamics drive camera, director composes ──

      // Update flight dynamics (gravity integration, state detection)
      this.flight.update(deltaTime);

      // Update cinematic director (framing, look target)
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

      // Camera position = flight position + (director offset × chase scale)
      this.camera.position.copy(this.flight.position);
      this.camera.position.addScaledVector(this.director._currentOffset, this._chaseScale);

      // Base orientation = look at director's smoothed target
      this.camera.lookAt(this.director._currentLookTarget);

      // Then nudge the look direction by the player's decaying offset
      if (this._lookOffsetYaw !== 0 || this._lookOffsetPitch !== 0) {
        this._applyLookOffset();
      }
    } else {
      // ── TOY_BOX MODE: legacy orbit math drives camera ──
      this._applyOrbit();
    }

    // Record post-update diagnostics
    this._diagnostics.record(
      this.camera, this.flight, this.director,
      flightMode, deltaTime, false
    );
  }

  /**
   * Rotate the camera's look direction by the player's decaying offset
   * (Flight mode only). Runs AFTER the director writes its transform so
   * the director stays unaware of player input.
   *
   * Technique: pull the current look vector, rotate by yaw around local
   * up then pitch around local right, reconstruct a new look target at
   * the same distance, and re-lookAt.
   */
  _applyLookOffset() {
    const pos = this.camera.position;

    // Current look vector (director wrote camera.lookAt(_currentLookTarget))
    const look = _v1.subVectors(this.director._currentLookTarget, pos);
    const dist = look.length();
    if (dist < 1e-6) return;
    look.divideScalar(dist);

    // Yaw rotates around world up (keeps the horizon level)
    const worldUp = _v2.set(0, 1, 0);
    _q1.setFromAxisAngle(worldUp, this._lookOffsetYaw);
    look.applyQuaternion(_q1);

    // Pitch rotates around the ship's local right axis (post-yaw)
    const right = _v3.crossVectors(look, worldUp);
    if (right.lengthSq() > 1e-8) {
      right.normalize();
      _q2.setFromAxisAngle(right, this._lookOffsetPitch);
      look.applyQuaternion(_q2);
    }

    // Re-aim the camera at a point along the rotated look vector
    _v4.copy(pos).addScaledVector(look, dist);
    this.camera.lookAt(_v4);
  }

  /** Exponentially decay the look offset back to center. */
  _decayLookOffset(deltaTime) {
    const factor = Math.exp(-deltaTime / LOOK_OFFSET_DECAY_TAU);
    this._lookOffsetYaw *= factor;
    this._lookOffsetPitch *= factor;
    if (Math.abs(this._lookOffsetYaw) < LOOK_OFFSET_SNAP_THRESHOLD) this._lookOffsetYaw = 0;
    if (Math.abs(this._lookOffsetPitch) < LOOK_OFFSET_SNAP_THRESHOLD) this._lookOffsetPitch = 0;
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
      // Free-look path: unchanged (deep sky / middle-mouse look-around)
      if (this.isFreeLooking) {
        this.yaw -= e.movementX * this.dragSensitivity;
        this.pitch += e.movementY * this.dragSensitivity;
        const limit = (85 * Math.PI) / 180;
        this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
        this._recomputeTargetForFreeLook();
        return;
      }
      if (!this.isDragging) return;

      if (this.isFlightMode) {
        // Flight: drag adds a decaying first-person look offset.
        // Convention: mouse right → look right (yaw-), mouse down → look down (pitch+).
        this._lookOffsetYaw   -= e.movementX * this.dragSensitivity;
        this._lookOffsetPitch += e.movementY * this.dragSensitivity;
        this._lookOffsetYaw = Math.max(-LOOK_OFFSET_MAX_YAW,
                              Math.min(LOOK_OFFSET_MAX_YAW, this._lookOffsetYaw));
        this._lookOffsetPitch = Math.max(-LOOK_OFFSET_MAX_PITCH,
                                Math.min(LOOK_OFFSET_MAX_PITCH, this._lookOffsetPitch));
      } else {
        // Toy Box: drag rotates the orbit (legacy behavior, now alive again)
        this.yaw -= e.movementX * this.dragSensitivity;
        this.pitch += e.movementY * this.dragSensitivity;
        const limit = (85 * Math.PI) / 180;
        this.pitch = Math.max(-limit, Math.min(limit, this.pitch));
      }
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (this.isFlightMode) {
        // Flight: scroll changes chase distance scale (pull camera in/out)
        const step = -Math.sign(e.deltaY) * CHASE_SCALE_STEP;
        this._chaseScale = Math.max(CHASE_SCALE_MIN,
                           Math.min(CHASE_SCALE_MAX, this._chaseScale + step));
      } else {
        // Toy Box: scroll changes orbit distance
        this.zoomSpeed += Math.sign(e.deltaY) * this.scrollSensitivity;
      }
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
