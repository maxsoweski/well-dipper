/**
 * WarpEffect — manages the warp transition between star systems.
 *
 * Four phases:
 *   1. FOLD   (~3s) — stars pinch inward toward screen center, scene fades out
 *   2. ENTER  (~1s) — white flash as camera flies into the "slice"
 *   3. HYPER  (~10s) — abstract tunnel streaks, system swap happens here
 *   4. EXIT   (~2s) — hyperspace fades, new system appears
 *
 * This class only manages timing and uniform values.
 * The actual visuals live in Starfield (fold) and RetroRenderer (composite).
 */
export class WarpEffect {
  constructor() {
    this.state = 'idle';   // 'idle' | 'fold' | 'enter' | 'hyper' | 'exit'
    this.elapsed = 0;      // seconds into current phase
    this.progress = 0;     // 0→1 within current phase

    // Phase durations (seconds)
    this.FOLD_DUR = 3.0;
    this.ENTER_DUR = 1.0;
    this.HYPER_DUR = 10.0;
    this.EXIT_DUR = 2.0;

    // ── Uniform values (read by Starfield + RetroRenderer each frame) ──
    this.foldAmount = 0;      // 0 = normal, 1 = fully folded to center
    this.starBrightness = 1;  // brightness multiplier for stars (1 = normal)
    this.sceneFade = 0;       // 0 = scene visible, 1 = scene hidden
    this.whiteFlash = 0;      // 0 = no flash, 1 = full white screen
    this.hyperPhase = 0;      // 0 = not in hyperspace, 1 = full hyperspace
    this.hyperTime = 0;       // accumulated time for hyperspace animation

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

    // Scene objects fade out during second half of fold
    this.sceneFade = this._ease(Math.max(0, (this.progress - 0.3) / 0.7));

    // Transition to ENTER
    if (this.elapsed >= this.FOLD_DUR) {
      this.state = 'enter';
      this.elapsed = 0;
    }
  }

  _updateEnter() {
    this.progress = Math.min(1, this.elapsed / this.ENTER_DUR);
    const t = this._ease(this.progress);

    // Keep stars fully folded
    this.foldAmount = 1;
    this.starBrightness = 3.0;
    this.sceneFade = 1;

    // White flash peaks at ~60% then fades into hyperspace
    if (this.progress < 0.6) {
      this.whiteFlash = this._ease(this.progress / 0.6);
    } else {
      this.whiteFlash = 1 - this._ease((this.progress - 0.6) / 0.4);
    }

    // Hyperspace fades in during second half
    this.hyperPhase = this._ease(Math.max(0, (this.progress - 0.4) / 0.6));

    // Transition to HYPER
    if (this.elapsed >= this.ENTER_DUR) {
      this.state = 'hyper';
      this.elapsed = 0;
      this.whiteFlash = 0;
      this.hyperPhase = 1;
      this.foldAmount = 0;  // stars hidden during hyperspace anyway
      this.starBrightness = 0;  // hide normal stars
    }
  }

  _updateHyper() {
    this.progress = Math.min(1, this.elapsed / this.HYPER_DUR);
    this.hyperTime = this.elapsed; // accumulate for animation

    // Full hyperspace
    this.hyperPhase = 1;
    this.sceneFade = 1;
    this.foldAmount = 0;
    this.starBrightness = 0;

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

    // Stars fade back in
    this.starBrightness = t;
    this.foldAmount = 0;

    // Scene stays hidden until near the end (new system reveal)
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
  }
}
