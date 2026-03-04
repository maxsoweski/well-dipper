/**
 * WarpEffect — manages the warp transition between star systems.
 *
 * Four phases:
 *   1. FOLD   (~6s) — stars streak inward toward screen center, forming a
 *                      bright vertical "slice". A glowing core thickens at
 *                      center. Camera pushes forward, planets fall behind.
 *   2. ENTER  (~2s) — white flash as camera flies into the glowing core,
 *                      scene objects fade, hyperspace takes over.
 *   3. HYPER  (~10s) — geometric tunnel (Star Fox 64 / NMS style),
 *                       system swap happens 1s in.
 *   4. EXIT   (~2s) — hyperspace fades, new starfield + system appear.
 *
 * This class only manages timing and uniform values.
 * The actual visuals live in Starfield (fold/streak) and RetroRenderer (composite).
 */
export class WarpEffect {
  constructor() {
    this.state = 'idle';   // 'idle' | 'fold' | 'enter' | 'hyper' | 'exit'
    this.elapsed = 0;      // seconds into current phase
    this.progress = 0;     // 0→1 within current phase

    // Phase durations (seconds)
    this.FOLD_DUR = 6.0;
    this.ENTER_DUR = 2.0;
    this.HYPER_DUR = 10.0;
    this.EXIT_DUR = 2.0;

    // ── Uniform values (read by Starfield + RetroRenderer each frame) ──
    this.foldAmount = 0;          // 0 = normal, 1 = fully folded to center
    this.starBrightness = 1;      // brightness multiplier for stars (1 = normal)
    this.sceneFade = 0;           // 0 = scene visible, 1 = scene hidden
    this.whiteFlash = 0;          // 0 = no flash, 1 = full white screen
    this.hyperPhase = 0;          // 0 = not in hyperspace, 1 = full hyperspace
    this.hyperTime = 0;           // accumulated time for hyperspace animation
    this.foldGlow = 0;            // 0 = no glow, 1 = full bright core at center
    this.cameraForwardSpeed = 0;  // units/s to push camera forward during fold

    // ── Callbacks (set by main.js) ──
    this.onSwapSystem = null;  // called at start of hyperspace
    this.onComplete = null;    // called when exit finishes

    this._swapFired = false;   // ensure onSwapSystem fires only once
  }

  /** Is the warp currently active? */
  get isActive() {
    return this.state !== 'idle';
  }

  /** Kick off the warp sequence. */
  start() {
    if (this.state !== 'idle') return;
    this.state = 'fold';
    this.elapsed = 0;
    this.progress = 0;
    this._swapFired = false;
    this._resetUniforms();
  }

  /** Smootherstep easing (slow start + end). */
  _ease(t) {
    t = Math.max(0, Math.min(1, t));
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  /**
   * Advance the warp by deltaTime. Call every frame.
   * Returns the current state string.
   */
  update(dt) {
    if (this.state === 'idle') return 'idle';

    this.elapsed += dt;

    switch (this.state) {
      case 'fold':
        this._updateFold();
        break;
      case 'enter':
        this._updateEnter();
        break;
      case 'hyper':
        this._updateHyper();
        break;
      case 'exit':
        this._updateExit();
        break;
    }

    return this.state;
  }

  // ── Phase update methods ──

  _updateFold() {
    this.progress = Math.min(1, this.elapsed / this.FOLD_DUR);
    const t = this._ease(this.progress);

    // Stars fold inward smoothly
    this.foldAmount = t;

    // Stars get brighter as they compress (accumulation effect)
    this.starBrightness = 1 + t * 2.0;  // up to 3x brightness

    // Planets stay visible during fold — NO sceneFade
    this.sceneFade = 0;

    // Fold glow: bright core appears after 30% progress, ramps to full
    this.foldGlow = this._ease(Math.max(0, (this.progress - 0.3) / 0.7));

    // Camera accelerates forward (base speed + quadratic ramp so motion is visible early)
    this.cameraForwardSpeed = 8 + 72 * this.progress * this.progress;

    // Transition to ENTER
    if (this.elapsed >= this.FOLD_DUR) {
      this.state = 'enter';
      this.elapsed = 0;
    }
  }

  _updateEnter() {
    this.progress = Math.min(1, this.elapsed / this.ENTER_DUR);
    const t = this._ease(this.progress);

    // Keep stars fully folded, then fade them out
    this.foldAmount = 1;
    this.starBrightness = 3.0 * (1 - t);  // 3 → 0, stars disappear
    this.foldGlow = 1;

    // Scene objects fade as we fly past them into the slice
    this.sceneFade = this._ease(this.progress);

    // Camera decelerates
    this.cameraForwardSpeed = 80 * (1 - t);

    // White flash peaks at ~50% then fades into hyperspace
    if (this.progress < 0.5) {
      this.whiteFlash = this._ease(this.progress / 0.5);
    } else {
      this.whiteFlash = 1 - this._ease((this.progress - 0.5) / 0.5);
    }

    // Hyperspace fades in during second half
    this.hyperPhase = this._ease(Math.max(0, (this.progress - 0.3) / 0.7));

    // Transition to HYPER
    if (this.elapsed >= this.ENTER_DUR) {
      this.state = 'hyper';
      this.elapsed = 0;
      this.whiteFlash = 0;
      this.hyperPhase = 1;
      this.foldAmount = 0;
      this.foldGlow = 0;
      this.starBrightness = 0;
      this.cameraForwardSpeed = 30;  // Match hyper phase speed
    }
  }

  _updateHyper() {
    this.progress = Math.min(1, this.elapsed / this.HYPER_DUR);
    this.hyperTime = this.elapsed;

    // Full hyperspace
    this.hyperPhase = 1;
    this.sceneFade = 1;
    this.foldAmount = 0;
    this.foldGlow = 0;
    this.starBrightness = 0;
    this.cameraForwardSpeed = 30;  // Maintain forward momentum through hyperspace

    // Fire system swap callback 1s into hyperspace
    if (!this._swapFired && this.elapsed >= 1.0) {
      this._swapFired = true;
      if (this.onSwapSystem) this.onSwapSystem();
    }

    // Transition to EXIT
    if (this.elapsed >= this.HYPER_DUR) {
      this.state = 'exit';
      this.elapsed = 0;
    }
  }

  _updateExit() {
    this.progress = Math.min(1, this.elapsed / this.EXIT_DUR);
    const t = this._ease(this.progress);

    // Hyperspace fades out
    this.hyperPhase = 1 - t;

    // Stars unfold: reappear bright and folded, then expand outward
    // (mirrors the fold phase in reverse)
    this.foldAmount = 1 - t;         // 1→0: folded → unfolded
    this.starBrightness = 1 + 2 * (1 - t);  // 3→1: bright → normal
    this.foldGlow = 1 - t;           // 1→0: rift line shrinks away

    // Camera decelerates toward the star
    this.cameraForwardSpeed = 30 * (1 - t);

    // Scene reveals in second half (planets appear after stars unfold)
    this.sceneFade = 1 - this._ease(Math.max(0, (this.progress - 0.5) / 0.5));

    // Done
    if (this.elapsed >= this.EXIT_DUR) {
      this.state = 'idle';
      this._resetUniforms();
      if (this.onComplete) this.onComplete();
    }
  }

  _resetUniforms() {
    this.foldAmount = 0;
    this.starBrightness = 1;
    this.sceneFade = 0;
    this.whiteFlash = 0;
    this.hyperPhase = 0;
    this.hyperTime = 0;
    this.foldGlow = 0;
    this.cameraForwardSpeed = 0;
  }
}
