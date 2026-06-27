// src/flight/SupercruiseModel.js
//
// Elite-Dangerous-style supercruise flight model — the single authoritative
// source of in-system ship motion (contract supercruise-freelook-2026-06-10).
// Pure math: no scene graph, no DOM. Positions are SCENE-LOCAL (rebased frame);
// main.js registers `position` for world-origin rebase subtraction.
import * as THREE from 'three';

export const SC_TUNING = {
  ETA_K: 3.0,               // speed cap = surfaceDist / ETA_K. Tuned 2026-06-24 (Bug B: 6 → 3) for perceptible
                            //   manual flight near small bodies. MUST stay ≥ 2.25: drop-safe at every body scale iff
                            //   cap at capture sphere (9R/ETA_K) ≤ dropMax (4R), i.e. ETA_K ≥ 9/4. Scale-free.
  CAP_MIN_FRAC: 0.5,        // per-body cap floor = radius × this (scale-free: capture stays possible at any body size)
  CAP_MIN_ABS: 1e-5,        // u/s absolute floor — pure numerical safety; MUST stay ≤ 5.3 × smallest capturable body radius (capture needs 0.75×floor ≤ 4R; smallest moon ≈ 4e-5)
  CAP_MAX: 20000.0,         // u/s deep-space ceiling
  ACCEL_TAU: 0.6,           // s — exponential approach to target speed. Tuned 2026-06-24 (Bug B: 1.4 → 0.6) for a
                            //   responsive throttle (perceptible within ~1.3s). MUST stay ≤ ETA_K/4 (=0.75 here) or
                            //   full-throttle approach decel turns underdamped and surges.
  COAST_TAU: 8.0,           // s — gentle exponential speed decay while the drive is OFF (dropped out / coasting).
                            //   NOT a scale-bug floor: the gravity-well speedCap still clamps coasting speed so a
                            //   nearby body parks you. Long (8s) so dropped-out momentum is preserved, not zeroed.
  TURN_RATE_MAX: 0.7,       // rad/s at rest
  TURN_RATE_MIN_FRAC: 0.25, // turn authority remaining at full local speed
  THROTTLE_RATE: 0.6,       // throttle units/s for held W/S stepping
};

export class SupercruiseModel {
  constructor(tuning = {}) {
    this.tuning = { ...SC_TUNING, ...tuning };
    this.position = new THREE.Vector3();      // scene-local (rebased) frame
    this.orientation = new THREE.Quaternion();
    this.speed = 0;                            // u/s along the nose (signed: reverse < 0)
    this.throttle = 0;                         // -1..1
    this._driveOn = true;                      // supercruise drive engaged. OFF → coast (momentum preserved)
    this.turnInput = { yaw: 0, pitch: 0 };     // -1..1 each
    this._bodies = [];                         // [{ position: Vector3, radius: number }]
    this._nose = new THREE.Vector3();
    this._euler = new THREE.Euler();
    this._q = new THREE.Quaternion();
  }

  /** Bodies used for the gravity-well speed cap. Caller refreshes per tick
   *  with CURRENT rebased mesh positions (never cache across ticks). */
  setBodies(list) { this._bodies = list; }

  setThrottle(t) { this.throttle = THREE.MathUtils.clamp(t, -1, 1); }

  /** Engage (true) / drop out (false) the supercruise drive.
   *  OFF → the model stops propelling: it no longer ramps toward the throttle
   *  target. It COASTS — current velocity preserved, decaying gently by COAST_TAU,
   *  while the gravity-well speedCap still clamps the max so proximity to a body
   *  parks you. ON → the existing throttle/accel behavior resumes. */
  setDrive(on) { this._driveOn = !!on; }

  /** True while the supercruise drive is engaged; false while coasting (dropped out). */
  get driveOn() { return this._driveOn; }

  setTurnInput(yaw, pitch) {
    this.turnInput.yaw = THREE.MathUtils.clamp(yaw, -1, 1);
    this.turnInput.pitch = THREE.MathUtils.clamp(pitch, -1, 1);
  }

  /** Returns shared scratch unless `out` is passed — copy or pass `out` if held across update(). */
  nose(out = this._nose) {
    return out.set(0, 0, -1).applyQuaternion(this.orientation);
  }

  /** Gravity-well cap: min over bodies of max(floor, surfaceDist / ETA_K),
   *  where the floor scales with body radius so pilot capture
   *  (speed ≤ 4R) stays reachable at production radii (1e-4..5). */
  speedCap() {
    const t = this.tuning;
    let cap = t.CAP_MAX;
    for (const b of this._bodies) {
      const d = Math.max(0, this.position.distanceTo(b.position) - b.radius);
      const c = Math.max(t.CAP_MIN_ABS, b.radius * t.CAP_MIN_FRAC, d / t.ETA_K);
      if (c < cap) cap = c;
    }
    return cap;
  }

  /** Turn authority shrinks as speed approaches the local cap (Elite feel). */
  turnRateCap() {
    const t = this.tuning;
    const frac = Math.min(1, this.speed / Math.max(1e-6, this.speedCap()));
    return t.TURN_RATE_MAX * (1 - (1 - t.TURN_RATE_MIN_FRAC) * frac);
  }

  update(dt) {
    // Steering first: ship-local yaw/pitch at the capped rate.
    const rate = this.turnRateCap();
    const yaw = this.turnInput.yaw * rate * dt;
    const pitch = this.turnInput.pitch * rate * dt;
    if (yaw !== 0 || pitch !== 0) {
      this._q.setFromEuler(this._euler.set(pitch, yaw, 0, 'YXZ'));
      this.orientation.multiply(this._q).normalize();
    }
    // Speed update. Two regimes:
    if (this._driveOn) {
      // DRIVE ON: exponential approach to throttle × cap. The cap falling as we
      // near a body IS the Elite decel-on-approach.
      const target = this.throttle * this.speedCap();
      const k = 1 - Math.exp(-dt / this.tuning.ACCEL_TAU);
      this.speed += (target - this.speed) * k;
    } else {
      // DRIVE OFF (dropped out): COAST. Do NOT pull toward the throttle target —
      // preserve momentum, decaying only by the gentle COAST_TAU. The well cap
      // below still clamps it, so coasting into a body parks you.
      this.speed *= Math.exp(-dt / this.tuning.COAST_TAU);
    }
    // Gravity-well clamp (both regimes): magnitude never exceeds the local cap,
    // sign preserved (reverse momentum survives). Anti-clip: nose-into-a-body
    // engage can't exceed ~0 because the cap collapses to the surface floor.
    const cap = this.speedCap();
    if (this.speed > cap) this.speed = cap;
    else if (this.speed < -cap) this.speed = -cap;
    if (Math.abs(this.speed) < 1e-9) this.speed = 0;
    // The ONLY translation source: forward along the nose.
    this.position.addScaledVector(this.nose(), this.speed * dt);
  }
}
