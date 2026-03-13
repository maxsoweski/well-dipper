/**
 * WarpEffect — manages the warp transition between star systems.
 *
 * Four phases:
 *   1. FOLD   (~4s) — stars pinch radially toward center (360° fold).
 *                      A portal opens where stars are consumed, showing
 *                      hyperspace through it. Camera stays stationary.
 *   2. ENTER  (~1.5s) — portal grows to engulf the full screen. Scene
 *                      objects fade, stars disappear. No camera motion.
 *   3. HYPER  (~3s) — 3D geometric tunnel (ray-cylinder intersection).
 *                       System swap happens immediately (data pre-generated during FOLD).
 *   4. EXIT   (~1.5s) — fizzing hole opens in tunnel, revealing new system.
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
    this.FOLD_DUR = 4.0;
    this.ENTER_DUR = 1.5;
    this.HYPER_DUR = 3.0;
    this.EXIT_DUR = 2.0;

    // ── Uniform values (read by Starfield + RetroRenderer each frame) ──
    this.foldAmount = 0;          // 0 = normal, 1 = fully folded to center
    this.starBrightness = 1;      // brightness multiplier for stars (1 = normal)
    this.sceneFade = 0;           // 0 = scene visible, 1 = scene hidden
    this.whiteFlash = 0;          // reserved (unused — portal is the transition)
    this.hyperPhase = 0;          // 0 = not in hyperspace, 1 = full hyperspace
    this.hyperTime = 0;           // accumulated time for hyperspace animation
    this.foldGlow = 0;            // 0 = no portal, >0.25 = portal visible, >1 during ENTER
    this.exitReveal = 0;          // 0 = no opening, 1 = full opening (exit only)
    this.cameraForwardSpeed = 0;  // units/s to push camera (HYPER/EXIT only)

    // ── Rift direction (world-space, for future star selection) ──
    this.riftDirection = null;  // THREE.Vector3 or null (null = camera forward)

    // ── Callbacks (set by main.js) ──
    this.onPrepareSystem = null; // called at start of fold (pre-generate data)
    this.onSwapSystem = null;    // called at start of hyperspace
    this.onComplete = null;      // called when exit finishes

    this._prepareFired = false;  // ensure onPrepareSystem fires only once
    this._swapFired = false;     // ensure onSwapSystem fires only once
  }

  /** Is the warp currently active? */
  get isActive() {
    return this.state !== 'idle';
  }

  /**
   * Kick off the warp sequence.
   * @param {THREE.Vector3} [direction] — world-space rift direction (null = camera forward)
   */
  start(direction = null) {
    if (this.state !== 'idle') return;
    this.state = 'fold';
    this.elapsed = 0;
    this.progress = 0;
    this._prepareFired = false;
    this._swapFired = false;
    this._resetUniforms();
    // Set riftDirection AFTER _resetUniforms (which clears it)
    this.riftDirection = direction ? direction.clone().normalize() : null;
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

    // Accumulate hyperspace animation time from the very start of warp.
    // The tunnel needs to already be in motion when the portal first opens
    // (~3.5s in), so we run the clock from frame 1.
    this.hyperTime += dt;

    return this.state;
  }

  // ── Phase update methods ──

  _updateFold() {
    this.progress = Math.min(1, this.elapsed / this.FOLD_DUR);
    const t = this._ease(this.progress);

    // Fire prepare callback on first frame — pre-generate next system data
    // while stars are still on screen (cheap CPU work, no visual impact)
    if (!this._prepareFired) {
      this._prepareFired = true;
      if (this.onPrepareSystem) this.onPrepareSystem();
    }

    // Stars fold inward — use progress² (not smootherstep) so it starts
    // immediately and ramps up visibly. Stars should be moving from frame 1.
    this.foldAmount = this.progress * this.progress;

    // Stars get much brighter as they compress (light accretes at center)
    this.starBrightness = 1 + this.foldAmount * 4.0;  // up to 5x brightness

    // Scene objects visible early, start fading in last 30% of fold
    // as camera accelerates past them. Objects ahead fly past naturally;
    // this fade catches anything to the sides or behind.
    this.sceneFade = Math.max(0, (this.progress - 0.7) / 0.3);  // 0→1 over last 30%

    // Portal frontier. Tracks where stars have been significantly
    // consumed (localFold ≈ 0.5 in the starfield shader).
    // No portal until foldAmount > 0.175 — nearest stars must converge
    // before any opening appears. The shader adds a further gate at
    // foldGlow > 0.25 so portalRadius only > 0 once stars are fully cleared.
    // frontier = (foldAmount - 0.175) / 0.7 matches the starfield's
    // pullStart = dist * 0.7, pullEnd = pullStart + 0.35.
    const frontier = Math.max(0, (this.foldAmount - 0.175) / 0.7);
    this.foldGlow = Math.min(1, frontier);

    // Camera accelerates forward during fold — we fly toward the portal,
    // passing scene objects (planets, stars) along the way. Starts gentle,
    // ramps up with progress² so early fold is mostly star-folding visual.
    this.cameraForwardSpeed = this.progress * this.progress * 40;  // 0 → 40

    // Transition to ENTER
    if (this.elapsed >= this.FOLD_DUR) {
      this.state = 'enter';
      this.elapsed = 0;
    }
  }

  _updateEnter() {
    this.progress = Math.min(1, this.elapsed / this.ENTER_DUR);
    const t = this._ease(this.progress);

    // Keep stars fully folded, then fade them out.
    // Start at 5.0 to match FOLD end (1 + 1.0*4.0 = 5), no brightness jump.
    // Use linear progress — eased 't' has a slow start that creates a visual pause.
    this.foldAmount = 1;
    this.starBrightness = 5.0 * (1 - this.progress);  // 5 → 0, continuous from FOLD

    // Portal keeps growing to engulf the full screen.
    // Uses LINEAR progress (not eased t) to avoid the smootherstep's
    // slow start which would freeze the portal for ~0.4s at the boundary.
    // foldGlow 1→3 makes portalRadius go 0.375→1.375 (well past screen
    // diagonal ~1.02). No fade — the portal swallows the camera.
    this.foldGlow = 1 + this.progress * 2;

    // Scene fully faded (camera already past them from FOLD acceleration)
    this.sceneFade = 1;

    // Camera continues accelerating into the portal — 40 → 80
    this.cameraForwardSpeed = 40 + this.progress * 40;

    // No white flash — the portal IS the transition
    this.whiteFlash = 0;

    // NO hyperPhase ramp — the portal circle alone handles the transition.
    // hyperPhase fading in globally created a visible mismatch: the portal
    // covered ~80% of the screen, then the remaining corners faded in
    // via a different (uniform blend) mechanism. Let the portal be the
    // sole circular wipe; it reaches the corners at ~65% progress.
    this.hyperPhase = 0;

    // Transition to HYPER
    if (this.elapsed >= this.ENTER_DUR) {
      this.state = 'hyper';
      this.elapsed = 0;
      this.whiteFlash = 0;
      this.hyperPhase = 1;
      this.foldAmount = 0;
      this.foldGlow = 0;
      this.starBrightness = 0;
      this.cameraForwardSpeed = 80;  // Match hyper phase speed
    }
  }

  _updateHyper() {
    this.progress = Math.min(1, this.elapsed / this.HYPER_DUR);
    // hyperTime is accumulated in update() — not set from elapsed here,
    // because it needs to include time from the ENTER phase too.

    // Full hyperspace
    this.hyperPhase = 1;
    this.sceneFade = 1;
    this.foldAmount = 0;
    this.foldGlow = 0;
    this.starBrightness = 0;
    this.cameraForwardSpeed = 80;  // Maintain forward momentum through hyperspace

    // Fire system swap after a few frames of HYPER — give the tunnel
    // time to render so the GPU stall from mesh/shader creation is hidden
    // behind an already-visible tunnel (not a half-transitioned screen).
    // System data was already pre-generated during FOLD (onPrepareSystem).
    if (!this._swapFired && this.elapsed > 0.15) {
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

    // Hyperspace stays full — the hole mask handles the reveal
    this.hyperPhase = 1;

    // Exit reveal: ease-out (fast start, slow finish) — the hole should
    // crack open immediately, not sit as a tiny pinhole for half a second.
    // sqrt gives a strong ease-out curve: fast open → gradual completion.
    this.exitReveal = Math.sqrt(this.progress);

    // NO reverse fold — stars are normal, we see them through the hole
    this.foldAmount = 0;
    this.starBrightness = 1;
    this.foldGlow = 0;

    // Camera decelerates as we approach the portal
    this.cameraForwardSpeed = 80 * (1 - t);

    // Scene is fully visible from the start — the exit hole mask controls
    // what you see through. No fade needed; the star is immediately visible
    // the moment the pinhole opens.
    this.sceneFade = 0;

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
    this.exitReveal = 0;
    this.cameraForwardSpeed = 0;
    this.riftDirection = null;
  }
}
