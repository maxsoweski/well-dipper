/**
 * AutoNavigator — autopilot mode that tours the star system.
 *
 * Builds a visit queue from the current system, then advances through
 * it on a timer. Each stop calls a focus callback (provided by main.js)
 * that reuses the existing camera transition logic.
 *
 * The navigator also provides dynamic camera motion parameters (varying
 * orbit speed and pitch) so each stop feels alive and cinematic.
 */
export class AutoNavigator {
  constructor() {
    this.state = 'off';       // 'off' | 'active'
    this.queue = [];           // array of stop objects
    this.currentIndex = 0;     // which stop we're on
    this.stopTimer = 0;        // seconds spent at current stop
    this.transitionDelay = 2;  // seconds to wait for camera zoom-in before linger starts
    this.isTransitioning = true;

    // Per-stop camera motion randomization
    this.rotationDirection = 1;  // 1 = CW, -1 = CCW
    this.speedPhase = 0;         // random offset for speed sine wave
    this.pitchPhase = 0;         // random offset for pitch sine wave

    // Callbacks — set by main.js
    this.onFocusPlanet = null;
    this.onFocusStar = null;
    this.onFocusMoon = null;
    this.onOverview = null;
    this.onTourComplete = null;
  }

  /** Is the autopilot currently controlling the camera? */
  get isActive() {
    return this.state === 'active';
  }

  /**
   * Build the tour queue from the current system.
   */
  buildQueue(system) {
    this.queue = [];

    // Overview
    this.queue.push({ type: 'overview', linger: 5 });

    // Star(s)
    this.queue.push({ type: 'star', starIndex: 0, linger: 8 });
    if (system.isBinary && system.star2) {
      this.queue.push({ type: 'star', starIndex: 1, linger: 8 });
    }

    // Planets and their moons, inner to outer
    for (let i = 0; i < system.planets.length; i++) {
      const entry = system.planets[i];
      this.queue.push({
        type: 'planet',
        planetIndex: i,
        linger: this._planetLinger(entry),
      });

      for (let m = 0; m < entry.moons.length; m++) {
        this.queue.push({
          type: 'moon',
          planetIndex: i,
          moonIndex: m,
          linger: 10,
        });
      }
    }
  }

  /**
   * Linger time for a planet. Gas giants and ringed planets get more.
   */
  _planetLinger(entry) {
    const data = entry.planet.data;
    let base = 12;
    if (data.type === 'gas-giant' || data.type === 'hot-jupiter' || data.type === 'sub-neptune') {
      base += 3;
    }
    if (data.rings) {
      base += 2;
    }
    return base;
  }

  /**
   * Randomize camera motion parameters for the current stop.
   */
  _randomizeMotion() {
    this.rotationDirection = Math.random() < 0.5 ? 1 : -1;
    this.speedPhase = Math.random() * Math.PI * 2;
    this.pitchPhase = Math.random() * Math.PI * 2;
  }

  /** Start the tour from the beginning. */
  start(system) {
    this.buildQueue(system);
    this.currentIndex = 0;
    this.stopTimer = 0;
    this.isTransitioning = true;
    this.state = 'active';
    this._randomizeMotion();
    this._goToCurrentStop();
  }

  /** Stop autopilot completely. */
  stop() {
    this.state = 'off';
    this.queue = [];
    this.currentIndex = 0;
    this.stopTimer = 0;
  }

  /**
   * Jump the tour to a specific queue index.
   */
  jumpTo(index) {
    if (this.state !== 'active') return;
    if (index < 0 || index >= this.queue.length) return;
    this.currentIndex = index;
    this.stopTimer = 0;
    this.isTransitioning = true;
    this._randomizeMotion();
    this._goToCurrentStop();
  }

  /**
   * Jump to the first star stop in the queue.
   */
  jumpToStar() {
    const idx = this.queue.findIndex(s => s.type === 'star');
    if (idx >= 0) this.jumpTo(idx);
  }

  /**
   * Jump to a specific planet's stop in the queue.
   */
  jumpToPlanet(planetIndex) {
    const idx = this.queue.findIndex(
      s => s.type === 'planet' && s.planetIndex === planetIndex
    );
    if (idx >= 0) this.jumpTo(idx);
  }

  /**
   * Advance the tour by +1 (next) or -1 (previous).
   */
  advance(direction) {
    if (this.state !== 'active') return;
    if (this.queue.length === 0) return;
    let next = this.currentIndex + direction;
    if (next >= this.queue.length) next = 0;
    if (next < 0) next = this.queue.length - 1;
    this.jumpTo(next);
  }

  /**
   * Call every frame. Advances the tour timer and moves to next stop.
   */
  update(deltaTime) {
    if (this.state !== 'active') return;
    if (this.queue.length === 0) return;

    // Wait for camera transition to settle before counting linger
    if (this.isTransitioning) {
      this.stopTimer += deltaTime;
      if (this.stopTimer >= this.transitionDelay) {
        this.isTransitioning = false;
        this.stopTimer = 0;
      }
      return;
    }

    this.stopTimer += deltaTime;

    const currentStop = this.queue[this.currentIndex];
    if (this.stopTimer >= currentStop.linger) {
      // Advance to next stop
      this.currentIndex++;
      if (this.currentIndex >= this.queue.length) {
        if (this.onTourComplete) this.onTourComplete();
        this.currentIndex = 0; // loop
      }
      this.stopTimer = 0;
      this.isTransitioning = true;
      this._randomizeMotion();
      this._goToCurrentStop();
    }
  }

  /**
   * Navigate camera to the current stop using callbacks.
   */
  _goToCurrentStop() {
    const stop = this.queue[this.currentIndex];
    if (!stop) return;

    switch (stop.type) {
      case 'overview':
        if (this.onOverview) this.onOverview();
        break;
      case 'star':
        if (this.onFocusStar) this.onFocusStar(stop.starIndex);
        break;
      case 'planet':
        if (this.onFocusPlanet) this.onFocusPlanet(stop.planetIndex);
        break;
      case 'moon':
        if (this.onFocusMoon) this.onFocusMoon(stop.planetIndex, stop.moonIndex);
        break;
    }
  }

  /**
   * Get the current auto-rotate speed (oscillates over time).
   * Returns degrees/second, with per-stop random direction and phase.
   */
  getAutoRotateSpeed(time) {
    // Oscillate between 0.3 and 1.2 deg/s, period ~20s
    const speed = 0.75 + 0.45 * Math.sin(time * 0.31 + this.speedPhase);
    return speed * this.rotationDirection;
  }

  /**
   * Get the target pitch for dynamic camera motion (oscillates over time).
   * Returns radians.
   */
  getTargetPitch(time) {
    // Oscillate between -5° and +35°, period ~18s
    const minPitch = -0.087;  // -5 degrees
    const maxPitch = 0.61;    // +35 degrees
    const mid = (minPitch + maxPitch) / 2;
    const amp = (maxPitch - minPitch) / 2;
    return mid + amp * Math.sin(time * 0.35 + this.pitchPhase);
  }
}
