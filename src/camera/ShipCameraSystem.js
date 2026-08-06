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

// ORRERY two-phase glide (orrery-coherence-2026-07-15 → round 2b, Max's ruling
// 2026-07-17: "make orrery navigation always fly straight, by first centering on
// the target destination before flying over towards it"). History trail:
//   3-channel — pivot/yaw-pitch/log-distance eased at mismatched rates toward
//     independent endpoints → the distance collapsed before the pivot carried
//     over → a curved DOGLEG.
//   single-channel (31eae77) — one t drove camera P_start→P_final and target
//     T_start→body together → straight PATH, but the look ROTATED while the camera
//     translated, so a body clicked at screen edge slid edge→center WHILE flying
//     — read as a lateral slide-in. Straight path, wrong feel.
//   two-phase (this) — PHASE 1 AIM rotates the view in place (camera POSITION
//     frozen) until the body is centered, THEN PHASE 2 APPROACH translates the
//     camera straight down the settled camera→body ray with the body pinned
//     centered. Translation only ever happens while the body is already centered,
//     so a side-slide is impossible for poses reachable from the ORRERY overview
//     (body on-screen, in front, near the orbital plane — a hypothetical behind-
//     the-camera or near-zenith aim sweep could still roll the view, but no
//     ORRERY click can produce one).
// All durations are taste-tunable at Max's UAT.
const GLIDE_APPROACH_DURATION = 1.1;    // s for the straight approach ease t: 0→1 (smoothstep)
// AIM duration scales with the INITIAL angular offset between the current look
// direction and the camera→body ray, so an edge-of-screen click aims longer than a
// near-center one. Capped, and skipped entirely when already essentially centered.
const GLIDE_AIM_SECONDS_PER_RAD = 0.45; // ⇒ ~0.24s at 30°, hits the cap near ~89°
const GLIDE_AIM_MAX_DURATION = 0.7;     // s cap on the aim ease
const GLIDE_AIM_MIN_ANGLE = (2 * Math.PI) / 180; // <2° off-axis ⇒ skip aim, go straight to approach

// Glide phase tags (internal; the tests detect the AIM→APPROACH boundary
// implementation-agnostically as the first frame the camera position moves).
const GLIDE_PHASE_AIM = 0;
const GLIDE_PHASE_APPROACH = 1;

// ORRERY arrival zoom-in (orrery-entry-orbits-2026-07-20, AC4) — the log gap
// |ln(smoothedDistance) − ln(distance)| under which the far-spawn zoom counts as
// SETTLED (fires the far-plane restore hook). ε in log-units: at 1e-3 the camera
// sits within ~0.1% of the overview distance — visually landed. The global
// smoothing keeps closing the remaining sliver after the hook fires.
const ARRIVAL_SETTLE_LOG_EPS = 1e-3;

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

  record(camera, flight, director, gravityMode, deltaTime, bypassed, chaseScale = 1) {
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
      // Measures unexpected divergence: cam should be at
      // flight.pos + director.offset × chaseScale (matches the write at the
      // FLIGHT-mode position update — scrolling chase distance changes scale).
      if (gravityMode && flight && !bypassed) {
        const expectedX = flight.position.x + (director ? director._currentOffset.x * chaseScale : 0);
        const expectedY = flight.position.y + (director ? director._currentOffset.y * chaseScale : 0);
        const expectedZ = flight.position.z + (director ? director._currentOffset.z * chaseScale : 0);
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

    // ── ORRERY two-phase glide (orrery-coherence-2026-07-15 → round 2b) ──
    // Dedicated glide state used ONLY by glideFocus (the click-2 view move).
    // PHASE 1 AIM: camera POSITION frozen at `_glidePStart`, the look target eases
    //   `_glideTStart`→body over `_glideAimDuration` (∝ initial off-axis angle)
    //   until the body is centered. PHASE 2 APPROACH: camera translates
    //   `_glidePStart`→(body+`_glideDir`·standoff) over GLIDE_APPROACH_DURATION,
    //   the look pinned to the live body. `_glideBody` is the caller's LIVE Vector3
    //   (NOT a clone) so a moving moon is met at its live spot; `_glideDir` is
    //   re-derived from (P_start−body_live) at the phase boundary (the body may
    //   have moved during the aim) and frozen for the straight approach.
    this._gliding = false;
    this._glidePhase = GLIDE_PHASE_AIM; // AIM until the body is centered, then APPROACH
    this._glideAimT = 0;                // 0→1 aim ease progress
    this._glideAimDuration = 0;         // s, set per-glide from the initial off-axis angle
    this._glideApproachT = 0;           // 0→1 approach ease progress
    this._glideBody = null;
    this._glideStandoff = 0;
    this._glideDir = new THREE.Vector3(0, 0, 1);
    this._glidePStart = new THREE.Vector3();
    this._glideTStart = new THREE.Vector3();

    this.yaw = 0;
    this.pitch = 0.15;
    this.distance = 8;
    this.minDistance = 0.01;
    this.maxDistance = 50000;

    this.smoothedYaw = this.yaw;
    this.smoothedPitch = this.pitch;
    this.smoothedDistance = this.distance;
    this.smoothing = 0.08;

    // ── ORRERY arrival zoom-in (orrery-entry-orbits-2026-07-20, AC4) ──
    // beginArrivalZoom() re-seeds smoothedDistance to a FAR spawn; the existing
    // log-lerp (update(), smoothing 0.08) then closes it to the pre-set overview
    // `distance` — the camera zooms IN. `_arrivalActive` holds from arm until
    // settle OR any interruption; `_arrivalSettled` flips ONCE at the natural
    // log-gap close. `_arrivalOnSettle` (the far-plane restore hook) fires EXACTLY
    // once per arrival — on settle, or on any cancel/supersede — never twice,
    // never leaked. This does NOT touch the two-phase glide machinery (802cceb).
    this._arrivalActive = false;
    this._arrivalSettled = false;
    this._arrivalOnSettle = null;

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
    this._endArrival(false); // AC4: a real mode swap cancels a live arrival zoom

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
      // ORRERY focus state must not leak across the mode seam: end any in-flight
      // glide and restore the absolute zoom floor. Without this, an M-swap while
      // glide-focused on a star carries its radius*1.05 minDistance (~4.9) into
      // the supercruise-exit clamp and the next toy-box zoom floor.
      this._gliding = false;
      this.resetFocusMinDistance();
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

  // ── ORRERY arrival zoom-in (orrery-entry-orbits-2026-07-20, AC4) ──────
  // Seed the far spawn and arm the arrival. The CALLER has already framed the
  // overview (viewSystem set `distance`, pitch 0.7, maxDistance); this only
  // re-seeds smoothedDistance to the spawn so the existing log-lerp zooms IN to
  // that overview `distance`. CRUCIALLY it writes smoothedDistance, NEVER
  // this.distance — the wheel branch clamps `distance` to maxDistance (~overview)
  // and would snap a multi-million spawn; the log-lerp reads `distance` as its
  // UNCLAMPED target. A superseding call fires the prior onSettle first (the
  // far-plane restore can never leak), then re-arms fresh.
  // opts.onSettle fires EXACTLY once — at the natural settle, or on any cancel.
  beginArrivalZoom(spawnDistance, opts = {}) {
    // Supersede: an in-flight arrival's restore MUST run exactly once before the
    // new one arms (C5). No-op if nothing is active.
    this._endArrival(false);
    this.smoothedDistance = spawnDistance;
    this._arrivalActive = true;
    this._arrivalSettled = false;
    this._arrivalOnSettle = (typeof opts.onSettle === 'function') ? opts.onSettle : null;
  }

  // End the live arrival exactly once. `natural` true ⇒ the log gap closed (flip
  // _arrivalSettled); false ⇒ an interruption/supersede cancelled it. Either way
  // the onSettle hook fires once and is cleared, so no far-restore ever leaks or
  // double-fires. Guarded on _arrivalActive so repeat calls are no-ops.
  _endArrival(natural) {
    if (!this._arrivalActive) return;
    this._arrivalActive = false;
    if (natural) this._arrivalSettled = true;
    const cb = this._arrivalOnSettle;
    this._arrivalOnSettle = null;
    if (cb) cb();
  }

  setTarget(position) {
    this._endArrival(false); // AC4: retargeting cancels a live arrival zoom
    this.target.copy(position);
    this._targetGoal.copy(position);
    this._transitioning = false;
    this._returningToOrbit = false;
    this._gliding = false;
  }

  focusOn(position, viewDistance = 8) {
    this._endArrival(false); // AC4: a focus-snap cancels a live arrival zoom
    this.target.copy(position);
    this._targetGoal.copy(position);
    this._transitioning = false;
    this._returningToOrbit = false;
    this._gliding = false;

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

  // Glide-focus — the VIEW-ONLY sibling of focusOn (orrery-coherence-2026-07-15
  // AC5, Max: "click 1 selects, click 2 quickly moves us over to that body"). A
  // SEPARATE method (not an option on focusOn) so focusOn's SNAP semantics stay
  // byte-identical for its debug callers. Where focusOn snaps the whole pose,
  // glideFocus arms a dedicated TWO-PHASE glide (round 2b — see GLIDE_* consts +
  // _updateGlide): PHASE 1 rotates the view in place until the body is centered,
  // PHASE 2 flies the camera straight down the settled camera→body ray to the
  // standoff. This retires the single-channel side-slide (its look rotated WHILE
  // the camera translated, so an edge-clicked body slid edge→center while flying).
  // It never touches _applyOrbit/adoptCurrentPose math (the drift guard), and is
  // Toy-Box orbit only: the caller keeps bypassed=false and never calls flyTo, so
  // the pilot is untouched — nothing flies, the VIEW moves. `position` is the
  // caller's LIVE Vector3 (mesh.position, NOT a clone) so a moving moon is met at
  // its live spot; drag/wheel/select hand the glide back to orbit mid-EITHER phase.
  glideFocus(position, viewDistance = 8) {
    this._endArrival(false);        // AC4: arming a glide cancels a live arrival zoom
    this._transitioning = false;    // this glide owns the move — no pivot ease
    this._returningToOrbit = false;

    // Initial approach direction from the CURRENT camera→body ray. Re-derived at
    // the AIM→APPROACH boundary in _beginApproachPhase (the body may move during
    // the aim), but kept here for the degenerate fallback + the flight seed below.
    const dir = _v1.copy(this.camera.position).sub(position);
    const len = dir.length();
    if (len > 1e-6) dir.divideScalar(len);
    else dir.set(0, 0, 1);          // degenerate: camera on the body — arbitrary axis
    this._glideDir.copy(dir);

    // `position` is the caller's LIVE Vector3 (mesh.position) — stored by REFERENCE,
    // NOT cloned, so the glide re-reads a moving body's live spot (meets, not chases).
    this._glideBody = position;
    this._glideStandoff = viewDistance;
    this._glidePStart.copy(this.camera.position);
    this._glideTStart.copy(this.target);

    // AIM duration ∝ the INITIAL angular offset between the current look direction
    // and the camera→body ray (edge-of-screen click aims longer than a near-centre
    // one), capped, and skipped when already essentially centered (no aim stall on
    // the trivial on-axis click — the glide goes straight to the approach).
    this.camera.getWorldDirection(_v3);          // current forward
    const toBody = _v4.copy(position).sub(this.camera.position);
    const tbLen = toBody.length();
    let aimAngle = 0;
    if (tbLen > 1e-6) {
      toBody.divideScalar(tbLen);
      const d = Math.max(-1, Math.min(1, _v3.dot(toBody)));
      aimAngle = Math.acos(d);                   // radians
    }
    if (aimAngle < GLIDE_AIM_MIN_ANGLE) {
      this._glideAimDuration = 0;                // already centered — skip the aim
      this._glidePhase = GLIDE_PHASE_APPROACH;
    } else {
      this._glideAimDuration = Math.min(
        GLIDE_AIM_MAX_DURATION, GLIDE_AIM_SECONDS_PER_RAD * aimAngle,
      );
      this._glidePhase = GLIDE_PHASE_AIM;
    }
    this._glideAimT = 0;
    this._glideApproachT = 0;
    this._gliding = true;
    this._targetGoal.copy(position); // keep the pivot goal on the body (tidy handoff)
    this.zoomSpeed = 0;

    // Keep the flight system loosely in sync for a later Flight-mode switch, like
    // focusOn — seeded from the framed vantage along the ARM-TIME ray (the approach
    // re-derives dir post-aim; sub-second body drift makes the difference negligible).
    if (this._hasGravity && this.flight) {
      _v2.copy(position).addScaledVector(this._glideDir, viewDistance);
      this.flight.setPositionVelocity(_v2);
    }
  }

  // Advance the two-phase glide one frame.
  //   PHASE 1 AIM — the camera POSITION is never touched; the look target eases
  //     T_start→body (smoothstep) and camera.lookAt() rotates the view IN PLACE
  //     until the body is centered. When the aim ease completes, freeze the
  //     approach direction from the body's LIVE position and switch to APPROACH.
  //   PHASE 2 APPROACH — the camera translates P_start→(body+dir·standoff) on a
  //     smoothstep with the look PINNED to the live body, so the body stays
  //     centered the whole way (never slides in from the side). `dir` is frozen;
  //     P_final is re-derived from the LIVE body each frame (moving moons are MET,
  //     not chased). Both phases use smoothstep, so both endpoints have zero
  //     velocity and the AIM→APPROACH boundary has no jerk. After the approach t
  //     reaches 1 the camera stays pinned at body+dir·standoff each frame, tracking
  //     a still-moving body until an input hands off to orbit (_endGlideToOrbit).
  _updateGlide(deltaTime) {
    const body = this._glideBody;

    if (this._glidePhase === GLIDE_PHASE_AIM) {
      if (this._glideAimDuration > 1e-6) {
        this._glideAimT = Math.min(1, this._glideAimT + deltaTime / this._glideAimDuration);
        const t = this._glideAimT;
        const ease = t * t * (3 - 2 * t); // smoothstep — zero-velocity endpoints
        this.target.lerpVectors(this._glideTStart, body, ease);
        this.camera.lookAt(this.target);
        if (this._glideAimT >= 1) this._beginApproachPhase();
        return; // AIM never moves the camera position
      }
      // Zero-duration aim (already centered) — go straight to the approach.
      this._beginApproachPhase();
    }

    // PHASE 2 APPROACH
    this._glideApproachT = Math.min(1, this._glideApproachT + deltaTime / GLIDE_APPROACH_DURATION);
    const t = this._glideApproachT;
    const ease = t * t * (3 - 2 * t); // smoothstep — zero-velocity endpoints
    const pFinal = _v1.copy(body).addScaledVector(this._glideDir, this._glideStandoff);
    this.camera.position.lerpVectors(this._glidePStart, pFinal, ease);
    this.target.copy(body);           // look pinned to the live body — stays centered
    this.camera.lookAt(this.target);
  }

  // Freeze the approach direction from (P_start − body_live) at the AIM→APPROACH
  // boundary (the body may have moved during the aim), normalize, keep the
  // degenerate fallback (len < 1e-6 → (0,0,1)), reset the approach ease, and
  // switch the phase. Uses scratch _v2 (independent of _updateGlide's _v1 pFinal).
  _beginApproachPhase() {
    const dir = _v2.copy(this._glidePStart).sub(this._glideBody);
    const len = dir.length();
    if (len > 1e-6) dir.divideScalar(len);
    else dir.set(0, 0, 1);
    this._glideDir.copy(dir);
    this._glideApproachT = 0;
    this._glidePhase = GLIDE_PHASE_APPROACH;
  }

  // Hand the current glide pose back to the normal Toy-Box orbit with NO snap:
  // back-solve yaw/pitch/distance about the live target so the next _applyOrbit
  // reproduces the EXACT current camera position (mirrors adoptCurrentPose's
  // clamp + push-out-along-ray). Called by the input handlers (drag/wheel/pinch)
  // and by update() when a fresh select/pivot supersedes the glide. Deliberately
  // leaves _transitioning / _targetGoal untouched so a superseding select keeps
  // its pivot request intact.
  _endGlideToOrbit() {
    if (!this._gliding) return;
    this._gliding = false;
    const offset = _v1.copy(this.camera.position).sub(this.target);
    const rawDist = offset.length();
    const dist = Math.max(this.minDistance, Math.min(this.maxDistance, rawDist));
    if (rawDist > 1e-6) {
      this.yaw = Math.atan2(offset.x, offset.z);
      this.pitch = Math.asin(Math.max(-1, Math.min(1, offset.y / rawDist)));
      if (dist !== rawDist) {
        const dir = offset.divideScalar(rawDist);
        this.target.copy(this.camera.position).addScaledVector(dir, -dist);
      }
    }
    this.distance = dist;
    this.smoothedYaw = this.yaw;
    this.smoothedPitch = this.pitch;
    this.smoothedDistance = dist;
    this.zoomSpeed = 0;
  }

  // ── Radius-relative focus min-distance (orrery-coherence-2026-07-15, fix C) ──
  // While a body is focused/glided in ORRERY, allow wheel-zoom down to just above
  // the surface (radius·1.05). The constructor default 0.01 is an ABSOLUTE floor
  // that bottoms out at 2.5R–20R for sub-0.01 moons, so tiny moons could never be
  // approached. resetFocusMinDistance restores 0.01 for system-overview framing.
  // NOTE: does NOT change the constructor default 0.01 — flightExitAnchor.test.js
  // and the supercruise-exit adopt clamp both rely on that default.
  setFocusMinDistance(radius) {
    this.minDistance = radius * 1.05;
  }

  resetFocusMinDistance() {
    this.minDistance = 0.01;
  }

  viewSystem(systemRadius, center = null) {
    // orrery-coherence-2026-07-15 AC2 live-drive fix: systems spawned via the
    // instant-cut path (spawnSystem forWarp:false) live at their true galactic
    // world position, NOT at the origin the warp flow rebases to — anchoring
    // the overview at (0,0,0) framed empty space ~100k units from the system.
    // `center` (the star's world position) anchors the frame on the system;
    // omitted → origin, byte-equivalent for every pre-existing caller.
    this._endArrival(false); // AC4: re-framing (incl. Esc de-focus) cancels a live arrival
    if (center) {
      this.target.copy(center);
      this._targetGoal.copy(center);
    } else {
      this.target.set(0, 0, 0);
      this._targetGoal.set(0, 0, 0);
    }
    this._transitioning = false;
    this._returningToOrbit = false;
    this._gliding = false;
    // Fix C reset: framing the whole system clears any focused-body radius-relative
    // min-distance clamp back to the absolute 0.01 floor. viewSystem is the shared
    // overview primitive for BOTH _frameSystemForOrrery (system entry) and
    // focusPlanet(-1) (ORRERY Esc de-focus), so every overview path resets here.
    this.resetFocusMinDistance();
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
    } else if (!this._transitioning && !this._gliding) {
      // A two-phase glide OWNS the look target (phase-1 eased aim, phase-2 pin on
      // the live body). main.js simStep calls trackTarget(body) EVERY frame while a
      // body is focused; stomping this.target here would defeat the eased aim into
      // an instant snap. _targetGoal (updated above) still follows the body for a
      // superseding select's pivot request; the interrupt handback back-solves
      // about this.target (the eased look point), NOT _targetGoal.
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
    this._endArrival(false); // AC4: entering free-look cancels a live arrival zoom
    this._gliding = false;
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
    this._gliding = false;

    const offset = this.camera.position.clone().sub(targetPosition);
    const dist = offset.length();
    const yaw = Math.atan2(offset.x, offset.z);
    const pitch = Math.asin(Math.max(-1, Math.min(1, offset.y / (dist || 1))));

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

  /**
   * Adopt the camera's CURRENT world pose as a Toy Box orbit — no teleport.
   *
   * Like restoreFromWorldState, this anchors the orbit on `anchorPosition`
   * (e.g. the closest body) and back-solves yaw/pitch/distance from the live
   * camera position, so the next _applyOrbit reconstructs the SAME position
   * the camera is already at. Two differences that matter when handing off
   * from a supercruise pose that may be very far out:
   *
   *   1. The back-solved distance is CLAMPED to [minDistance, maxDistance].
   *      An un-clamped supercruise distance (tens of thousands of units) would
   *      otherwise live outside the zoom range the orbit code expects.
   *   2. When the distance IS clamped, the orbit target is pushed OUT along the
   *      camera→anchor ray so `target + clampedDist * dir` still lands exactly
   *      on the camera's current position. So position is preserved even when
   *      the raw distance was out of range — the orbit just rotates around a
   *      virtual anchor along the same sight line until the player zooms.
   *
   * Callers MUST resync the render interpolator (cameraInterp.resync) right
   * after, so the fixed-timestep blend doesn't lerp across the mode flip.
   *
   * DRIFT GUARD: src/flight/__tests__/flightExitAnchor.test.js re-implements
   * this math (and _applyOrbit, plus the minDistance/maxDistance clamp) inline
   * to assert the no-snap exit invariant. If this method or those clamp bounds
   * change, update that test in lockstep or it will silently test stale math.
   */
  adoptCurrentPose(anchorPosition) {
    this.bypassed = false;
    this._transitioning = false;
    this._returningToOrbit = false;
    this._gliding = false;

    const offset = _v1.copy(this.camera.position).sub(anchorPosition);
    const rawDist = offset.length();
    const yaw = Math.atan2(offset.x, offset.z);
    const pitch = Math.asin(Math.max(-1, Math.min(1, offset.y / (rawDist || 1))));
    const dist = Math.max(this.minDistance, Math.min(this.maxDistance, rawDist));

    // Anchor the orbit so the clamped distance reproduces the EXACT current
    // camera position. With dir = unit(camera - anchor), the orbit places the
    // camera at target + dist*dir; solving for target = camera - dist*dir.
    if (rawDist > 1e-6) {
      const dir = offset.divideScalar(rawDist); // offset now normalized (_v1)
      this.target.copy(this.camera.position).addScaledVector(dir, -dist);
    } else {
      this.target.copy(anchorPosition);
    }
    this._targetGoal.copy(this.target);

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

    // ── ORRERY two-phase glide owns the Toy-Box camera while active ──
    // A freshly-requested pivot ease (a select of a NEW body sets _transitioning
    // directly, main.js) supersedes the glide: hand the current pose to orbit
    // (works mid-AIM or mid-APPROACH) and fall through to the normal transition/
    // smoothing path. Otherwise the glide drives camera+target for this frame and
    // returns (skips zoom/drift/smoothing).
    if (this._gliding) {
      if (this._transitioning) {
        this._endGlideToOrbit();
      } else {
        this._updateGlide(deltaTime);
        this._diagnostics.record(
          this.camera, this.flight, this.director,
          flightMode, deltaTime, false, this._chaseScale
        );
        return;
      }
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

    // ── ORRERY arrival zoom-in settle probe (AC4) ──
    // Once the log gap the arrival is closing shrinks under ε, the far-spawn zoom
    // has visually landed on the overview: flip _arrivalSettled ONCE and fire the
    // far-plane restore hook exactly once. The lerp keeps closing the sliver after.
    if (this._arrivalActive) {
      const arrivalGap = Math.abs(logTarget - Math.log(this.smoothedDistance));
      if (arrivalGap < ARRIVAL_SETTLE_LOG_EPS) this._endArrival(true);
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
      flightMode, deltaTime, false, this._chaseScale
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
        // Drag interrupts a glide: hand the current pose to orbit (no snap) so
        // the drag rotates from where the glide had reached (interrupt parity —
        // on HEAD a mid-glide drag likewise steered the ongoing move).
        if (this._gliding) this._endGlideToOrbit();
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
        // Toy Box: scroll changes orbit distance. Wheel interrupts a glide —
        // hand off to orbit first so the zoom applies to the settled pose (and
        // reaches the radius-relative min-distance set on the focused body).
        // It also interrupts an arrival zoom (AC4): the player grabbed the wheel;
        // cancel the arrival and fire the far-plane restore before applying zoom.
        this._endArrival(false);
        if (this._gliding) this._endGlideToOrbit();
        this.zoomSpeed += Math.sign(e.deltaY) * this.scrollSensitivity;
      }
    }, { passive: false });

    // ── Touch controls ──
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this._touchCount = e.touches.length;
      // Touch drag / pinch interrupts a glide — hand off to orbit first (parity
      // with the mouse drag/wheel paths).
      if (this._gliding) this._endGlideToOrbit();
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
