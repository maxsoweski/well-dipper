/**
 * AutoNavigator — autopilot mode that tours the star system.
 *
 * Builds a visit queue from the current system. Each stop stores a reference
 * to the Three.js mesh so the FlythroughCamera can orbit/travel to it.
 *
 * The navigator manages the queue order and timing. FlythroughCamera handles
 * all the actual camera motion.
 */
export class AutoNavigator {
  constructor() {
    this.state = 'off';       // 'off' | 'active'
    this.queue = [];           // array of stop objects
    this.currentIndex = 0;     // which stop we're on

    // Callbacks — set by main.js
    this.onTourComplete = null;
  }

  /** Is the autopilot currently controlling the camera? */
  get isActive() {
    return this.state === 'active';
  }

  /**
   * Build the flythrough tour queue from the current system.
   * Each stop has: type, bodyRef, orbitDistance, bodyRadius, linger.
   * bodyRef/orbitDistance/bodyRadius are populated later by main.js
   * (it has access to the meshes).
   */
  buildQueue(system) {
    this.queue = [];

    // Star(s) — first stop (camera descends into orbit around star)
    this.queue.push({
      type: 'star',
      starIndex: 0,
      bodyRef: null,
      orbitDistance: 0,
      bodyRadius: 0,
      linger: 15,
    });

    if (system.isBinary && system.star2) {
      this.queue.push({
        type: 'star',
        starIndex: 1,
        bodyRef: null,
        orbitDistance: 0,
        bodyRadius: 0,
        linger: 12,
      });
    }

    // Planets and their moons, inner to outer
    for (let i = 0; i < system.planets.length; i++) {
      const entry = system.planets[i];
      this.queue.push({
        type: 'planet',
        planetIndex: i,
        bodyRef: null,
        orbitDistance: 0,
        bodyRadius: 0,
        linger: this._planetLinger(entry),
      });

      for (let m = 0; m < entry.moons.length; m++) {
        this.queue.push({
          type: 'moon',
          planetIndex: i,
          moonIndex: m,
          bodyRef: null,
          orbitDistance: 0,
          bodyRadius: 0,
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
    let base = 15;
    if (data.type === 'gas-giant' || data.type === 'hot-jupiter' || data.type === 'sub-neptune') {
      base += 3;
    }
    if (data.rings) {
      base += 2;
    }
    return base;
  }

  /** Start the tour from the beginning. */
  start() {
    this.currentIndex = 0;
    this.state = 'active';
  }

  /** Stop autopilot completely. */
  stop() {
    this.state = 'off';
    this.queue = [];
    this.currentIndex = 0;
  }

  /**
   * Get the current stop.
   */
  getCurrentStop() {
    if (this.currentIndex < this.queue.length) {
      return this.queue[this.currentIndex];
    }
    return null;
  }

  /**
   * Get the next stop (for departure steering / travel destination).
   */
  getNextStop() {
    const nextIdx = this.currentIndex + 1;
    if (nextIdx < this.queue.length) {
      return this.queue[nextIdx];
    }
    // Wrap to first stop
    if (this.queue.length > 0) {
      return this.queue[0];
    }
    return null;
  }

  /**
   * Advance to the next stop. Returns the new stop, or null if tour completed.
   */
  advanceToNext() {
    this.currentIndex++;
    if (this.currentIndex >= this.queue.length) {
      if (this.onTourComplete) this.onTourComplete();
      this.currentIndex = 0; // loop
    }
    return this.getCurrentStop();
  }

  /**
   * Jump the tour to a specific queue index.
   */
  jumpTo(index) {
    if (this.state !== 'active') return null;
    if (index < 0 || index >= this.queue.length) return null;
    this.currentIndex = index;
    return this.getCurrentStop();
  }

  /**
   * Jump to the first star stop in the queue.
   */
  jumpToStar() {
    const idx = this.queue.findIndex(s => s.type === 'star');
    if (idx >= 0) return this.jumpTo(idx);
    return null;
  }

  /**
   * Jump to a specific planet's stop in the queue.
   */
  jumpToPlanet(planetIndex) {
    const idx = this.queue.findIndex(
      s => s.type === 'planet' && s.planetIndex === planetIndex
    );
    if (idx >= 0) return this.jumpTo(idx);
    return null;
  }

  /**
   * Advance the tour by +1 (next) or -1 (previous).
   */
  advance(direction) {
    if (this.state !== 'active') return null;
    if (this.queue.length === 0) return null;
    let next = this.currentIndex + direction;
    if (next >= this.queue.length) next = 0;
    if (next < 0) next = this.queue.length - 1;
    return this.jumpTo(next);
  }
}
