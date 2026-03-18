import * as THREE from 'three';
import { Planet } from '../../objects/Planet.js';
import { Moon } from '../../objects/Moon.js';

/**
 * BodyRenderer — unified planet/moon renderer with physics data awareness.
 *
 * Currently delegates to the existing Planet.js and Moon.js renderers
 * (which have 949 lines of working shader code for 11+ planet types).
 * This wrapper provides:
 *
 *   1. A unified interface for LODManager (setLOD, getRadius, etc.)
 *   2. Physics data consumption (composition, atmosphere, surface history)
 *   3. A migration path — internals can be replaced incrementally
 *      without changing the interface used by main.js / LODManager
 *
 * Physics data consumed (currently stored, used in future LOD tiers):
 *   composition: { surfaceType, carbonToOxygen, ironFraction, volatileFraction }
 *   atmosphere: { retained, type, composition, pressure }
 *   tidalState: { locked, lockType }
 *   surfaceHistory: { bombardmentIntensity, erosionLevel, resurfacingRate }
 *
 * LOD tiers (managed externally by LODManager):
 *   0 — Billboard: colored pixel dot (Billboard.js, unchanged)
 *   1 — Orbital: current Planet.js / Moon.js mesh (this class manages it)
 *   2 — Close-up: enhanced detail (future — terrain, atmosphere scattering)
 *
 * Usage:
 *   const body = BodyRenderer.createPlanet(planetData, physicsData, starInfo);
 *   scene.add(body.mesh);
 *   body.update(deltaTime);
 */
export class BodyRenderer {
  /**
   * @param {'planet'|'moon'} bodyType
   * @param {object} bodyData — from PlanetGenerator or MoonGenerator
   * @param {object|null} physicsData — from PhysicsEngine (atmosphere, composition, etc.)
   * @param {object|null} starInfo — dual-star lighting info
   * @param {object|null} moonLightRefs — { lightDir, lightDir2 } refs from parent planet (moons only)
   */
  constructor(bodyType, bodyData, physicsData, starInfo, moonLightRefs) {
    this.bodyType = bodyType;
    this.data = bodyData;
    this.physics = physicsData;
    this._currentLOD = 1; // Start at orbital LOD

    // Store physics data for future LOD tier 2
    // These will drive close-up shaders when implemented
    this._composition = physicsData?.composition || null;
    this._atmosphere = physicsData?.atmosphere || null;
    this._tidalState = physicsData?.tidalState || null;
    this._surfaceHistory = physicsData?.surfaceHistory || null;

    // Create the delegate renderer (existing Planet.js or Moon.js)
    if (bodyType === 'planet') {
      this._delegate = new Planet(bodyData, starInfo);
    } else {
      // Moon needs parent planet's light direction references
      const lightDir = moonLightRefs?.lightDir || new THREE.Vector3(1, 0, 0);
      const lightDir2 = moonLightRefs?.lightDir2 || null;
      this._delegate = new Moon(bodyData, lightDir, lightDir2, starInfo);
    }

    // Expose the mesh for scene management
    this.mesh = this._delegate.mesh;

    // Expose surface for raycasting (Planet.js stores it)
    this.surface = this._delegate.surface;

    // Expose ring for Planet (if any)
    this.ring = this._delegate.ring || null;

    // Expose light direction refs (Planet.js) for moons to reference
    this._lightDir = this._delegate._lightDir || null;
    this._lightDir2 = this._delegate._lightDir2 || null;

  }

  // ── Factory methods ──

  static createPlanet(planetData, physicsData, starInfo) {
    return new BodyRenderer('planet', planetData, physicsData, starInfo, null);
  }

  /**
   * @param {object} moonData
   * @param {object|null} physicsData
   * @param {object|null} starInfo
   * @param {{ lightDir: THREE.Vector3, lightDir2: THREE.Vector3 }} parentLightRefs — from parent planet
   */
  static createMoon(moonData, physicsData, starInfo, parentLightRefs) {
    return new BodyRenderer('moon', moonData, physicsData, starInfo, parentLightRefs);
  }

  // ── LOD interface (for LODManager) ──

  get radius() {
    return this.data.radius;
  }

  get currentLOD() {
    return this._currentLOD;
  }

  /**
   * Switch LOD tier.
   * @param {number} tier — 0 (billboard), 1 (orbital), 2 (close-up)
   */
  setLOD(tier) {
    if (tier === this._currentLOD) return;
    this._currentLOD = tier;

    // TODO: Tier 0 handled externally by Billboard.js + LODManager
    // TODO: Tier 2 — load close-up detail (terrain, atmosphere scattering)
    //   this._loadCloseUpDetail() when tier 2 is implemented
    // TODO: Tier 1→2 transition: swap/augment shaders with physics-driven detail
  }

  // ── Delegate passthrough ──

  update(deltaTime, ...args) {
    if (this._delegate.update) {
      this._delegate.update(deltaTime, ...args);
    }
  }

  /**
   * Update light direction (for when star positions change in binary systems).
   */
  updateLightDir(lightDir, lightDir2) {
    if (this._delegate.updateLightDir) {
      this._delegate.updateLightDir(lightDir, lightDir2);
    }
  }

  /**
   * Update star positions for shadow casting.
   */
  updateStarPositions(pos1, pos2) {
    if (this._delegate.updateStarPositions) {
      this._delegate.updateStarPositions(pos1, pos2);
    }
  }

  /**
   * Set ring gaps from moon orbital data (Planet only).
   */
  setRingGaps(moonDataArray) {
    if (this._delegate.setRingGaps) {
      this._delegate.setRingGaps(moonDataArray);
    }
  }

  /**
   * Set shadow casters (moons transiting over planet surface).
   */
  setShadowMoons(moonPositions, moonRadii) {
    const mat = this._delegate.surface?.material;
    if (!mat?.uniforms?.shadowMoonCount) return;
    const count = Math.min(moonPositions.length, 6);
    mat.uniforms.shadowMoonCount.value = count;
    for (let i = 0; i < count; i++) {
      mat.uniforms.shadowMoonPos.value[i].copy(moonPositions[i]);
      mat.uniforms.shadowMoonRadius.value[i] = moonRadii[i];
    }
  }

  /**
   * Set neighbor planet shadow casters.
   */
  setShadowPlanets(planetPositions, planetRadii) {
    const mat = this._delegate.surface?.material;
    if (!mat?.uniforms?.shadowPlanetCount) return;
    const count = Math.min(planetPositions.length, 2);
    mat.uniforms.shadowPlanetCount.value = count;
    for (let i = 0; i < count; i++) {
      mat.uniforms.shadowPlanetPos.value[i].copy(planetPositions[i]);
      mat.uniforms.shadowPlanetRadius.value[i] = planetRadii[i];
    }
  }

  // ── Physics data accessors (for debug/display) ──

  getPhysicsSummary() {
    return {
      composition: this._composition,
      atmosphere: this._atmosphere,
      tidalState: this._tidalState,
      surfaceHistory: this._surfaceHistory,
    };
  }

  /**
   * Check if this body has a retained atmosphere (from physics).
   */
  hasAtmosphere() {
    return this._atmosphere?.retained === true;
  }

  /**
   * Check if this body is tidally locked (from physics).
   */
  isTidallyLocked() {
    return this._tidalState?.locked === true;
  }

  // ── Lifecycle ──

  addTo(scene) {
    scene.add(this.mesh);
  }

  removeFrom(scene) {
    scene.remove(this.mesh);
  }

  dispose() {
    if (this._delegate.dispose) {
      this._delegate.dispose();
    }
  }
}
