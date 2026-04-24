import * as THREE from 'three';

/**
 * VelocityBlend — shared state-tracker for phase-transition velocity
 * hand-off in NavigationSubsystem.
 *
 * Per docs/WORKSTREAMS/autopilot-phase-transition-velocity-continuity-
 * 2026-04-23.md: three seams (STATION→CRUISE, TRAVEL→APPROACH,
 * APPROACH→ORBIT) share one class of bug (each phase's starter recomputes
 * its own velocity basis from `_position` without consulting the previous
 * phase's terminal velocity). This helper is the shared scaffolding the
 * three seams consume — each seam reads `.blendT` + `.capturedVelocity`
 * and applies them to its own velocity-generating parameter.
 *
 * Usage:
 *
 *   // At phase-end in the leaving phase, before calling the next phase's
 *   // starter:
 *   const terminalVelocity = this._computeTerminalVelocity();
 *   this._velocityBlend.begin(terminalVelocity, 0.5);
 *
 *   // In the new phase's update, each frame:
 *   this._velocityBlend.advance(deltaTime);
 *   const t = this._velocityBlend.blendT;  // 0 = captured, 1 = authored
 *   const captured = this._velocityBlend.capturedVelocity;
 *   // Apply per-seam — e.g., for orbit tangential rate:
 *   const blendedRate = (1 - t) * capturedTangentialRate + t * authoredYawSpeed;
 *
 * Invariants (AC #1b/c, #2b/c, #3b/c):
 *   - Before .begin(): .active === false, .blendT === 1 (fully authored).
 *   - Immediately after .begin(): .active === true, .blendT === 0
 *     (fully captured — velocity continues at previous phase's terminal).
 *   - Mid-blend (0 < elapsed < duration): .blendT smoothsteps 0 → 1.
 *   - Post-blend (elapsed >= duration): .active flips false, .blendT === 1.
 *
 * Smoothstep (not linear) so velocity derivative is continuous at both
 * ends of the blend window — the fix for the velocity-DIRECTION flip
 * should not itself introduce a second-order jerk.
 */
export class VelocityBlend {
  constructor() {
    this._capturedVelocity = new THREE.Vector3();
    this._duration = 0;
    this._elapsed = 0;
    this._active = false;
  }

  /**
   * Begin a blend. Captures the terminal velocity vector of the leaving
   * phase and sets the blend window duration. After this call, `.blendT`
   * is 0 on the first `.advance()` tick and ramps to 1 over `duration`.
   *
   * @param {THREE.Vector3} capturedVelocity — terminal velocity of leaving phase.
   * @param {number} duration — seconds to blend over (typical 0.3–0.5).
   */
  begin(capturedVelocity, duration) {
    this._capturedVelocity.copy(capturedVelocity);
    this._duration = Math.max(0, duration);
    this._elapsed = 0;
    this._active = this._duration > 1e-6;
  }

  /** Per-frame tick. Call once per frame from the consuming phase's update. */
  advance(deltaTime) {
    if (!this._active) return;
    this._elapsed += deltaTime;
    if (this._elapsed >= this._duration) {
      this._active = false;
    }
  }

  /**
   * Smoothstepped 0 → 1 blend parameter.
   *   0 → authored phase velocity ignored; captured velocity fully applied.
   *   1 → captured velocity ignored; authored phase velocity fully applied.
   * When not active, returns 1 (phase authors unblended).
   */
  get blendT() {
    if (!this._active) return 1.0;
    const u = Math.min(1, this._elapsed / this._duration);
    return u * u * (3 - 2 * u);  // smoothstep — C1 continuous at both ends
  }

  get active() { return this._active; }
  get capturedVelocity() { return this._capturedVelocity; }
  get elapsed() { return this._elapsed; }
  get duration() { return this._duration; }

  /** Reset to inactive / unblended state. */
  reset() {
    this._capturedVelocity.set(0, 0, 0);
    this._duration = 0;
    this._elapsed = 0;
    this._active = false;
  }
}
