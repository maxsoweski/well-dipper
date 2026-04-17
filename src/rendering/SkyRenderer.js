import * as THREE from 'three';
import { GalaxyGlowLayer } from './sky/GalaxyGlowLayer.js';
import { ProceduralGlowLayer } from './sky/ProceduralGlowLayer.js';
import { SkyFeatureLayer } from './sky/SkyFeatureLayer.js';
import { StarfieldLayer } from './sky/StarfieldLayer.js';
import { GlowTextureManager } from './sky/GlowTextureManager.js';

/**
 * SkyRenderer — single coordinator for the entire sky background.
 *
 * Replaces the old pattern of main.js manually adding GalaxyGlow +
 * Starfield to retroRenderer.starfieldScene as independent systems.
 *
 * The SkyRenderer enforces a brightness hierarchy:
 *   galaxy glow (dimmest) < sky features < background stars (brightest sky element)
 *
 * Each sub-layer renders into a shared THREE.Scene with defined
 * brightness ranges so nothing can break the visual hierarchy.
 *
 * Usage:
 *   const sky = new SkyRenderer(galacticMap);
 *   sky.prepareForPosition(playerPos);   // CPU-side data gen (during warp FOLD)
 *   sky.activate();                       // create GPU resources (during warp HYPER)
 *   retroRenderer.setSkyRenderer(sky);
 *
 *   // Each frame:
 *   sky.update(camera, deltaTime);
 *
 *   // Warp fold:
 *   sky.setWarpUniforms(foldAmount, brightness, riftCenterNDC);
 */
export class SkyRenderer {
  /**
   * @param {object} galacticMap — GalacticMap instance (or null for legacy mode)
   * @param {object} starfieldGenerator — StarfieldGenerator class (static .generate())
   * @param {number} [starDensity=18000] — total background star count
   */
  constructor(galacticMap, starfieldGenerator, starDensity = 18000) {
    this._galacticMap = galacticMap;
    this._starfieldGenerator = starfieldGenerator;
    this._starDensity = starDensity;

    // The scene all sky layers render into
    this._scene = new THREE.Scene();

    // Sky sphere radii — glow behind stars
    this._glowRadius = 499;
    this._starfieldRadius = 500;

    // ── Brightness budget ──
    // Each layer outputs brightness within its assigned range.
    // Ranges are ordered so layers can't overpower each other:
    //   glow:     [0, 0.15]  — dimmest, diffuse unresolved stars
    //   features: [0, 0.25]  — nebulae/clusters (future, additive on glow)
    //   stars:    [0.10, 0.45] — resolved points, always pop over glow
    this._brightnessConfig = {
      glow:     { min: 0.0, max: 0.20 },
      features: { min: 0.0, max: 0.30 },
      stars:    { min: 0.15, max: 0.65 },
    };

    // Sub-layers (created in activate())
    this._glowLayer = null;
    this._featureLayer = null;
    this._starfieldLayer = null;

    // Origin layers — kept alive during warp crossover, disposed on completeWarpTransition()
    this._originStarfieldLayer = null;
    this._originGlowLayer = null;
    this._originFeatureLayer = null;
    this._crossoverActive = false;

    // Glow texture manager — handles loading + caching panoramas
    this._glowManager = new GlowTextureManager();

    // Prepared data (generated in prepareForPosition(), consumed in activate())
    this._pendingData = null;

    // Current player position
    this._playerPos = null;
  }

  /**
   * Pre-generate sky data for a new galactic position.
   * Call during warp FOLD phase — this is CPU work only, no GPU resources.
   *
   * @param {{ x: number, y: number, z: number }} playerPos — galactic position in kpc
   */
  prepareForPosition(playerPos) {
    this._playerPos = playerPos;

    // IMPORTANT: do NOT update the live glow layer here.
    // prepareForPosition runs at warp FOLD start — but the player is still
    // physically in the origin system (camera hasn't entered the tunnel yet).
    // Updating _glowLayer.setPlayerPosition(destinationPos) would push the
    // destination's glow pattern into the origin system's sky, visible as
    // "galactic glow changes in system A before going into tunnel" (Max
    // report 2026-04-16).
    //
    // The new position is applied to the glow only at activate() time, which
    // runs when the destination scene takes over (post-swap INSIDE crossing
    // in dual-portal mode). Until then, the existing glow continues showing
    // the origin system view.

    if (this._galacticMap && this._starfieldGenerator) {
      this._pendingData = this._starfieldGenerator.generate(
        this._galacticMap,
        playerPos,
        this._starDensity,
        this._starfieldRadius
      );
      // Query nearby galactic features for sky overlays
      this._pendingFeatures = this._galacticMap.findNearbyFeatures(playerPos, 3.0);
    } else {
      this._pendingData = null;
      this._pendingFeatures = null;
    }
  }

  /**
   * Async variant — defers the heavy HashGridStarfield search to
   * StarfieldGenerator.generateAsync, which yields between spectral-type
   * searches. Call during warp FOLD so the ~1s of sky generation doesn't
   * stall the main thread. Semantics otherwise identical to prepareForPosition.
   */
  async prepareForPositionAsync(playerPos) {
    this._playerPos = playerPos;
    if (this._galacticMap && this._starfieldGenerator) {
      this._pendingData = await this._starfieldGenerator.generateAsync(
        this._galacticMap,
        playerPos,
        this._starDensity,
        this._starfieldRadius
      );
      this._pendingFeatures = this._galacticMap.findNearbyFeatures(playerPos, 3.0);
    } else {
      this._pendingData = null;
      this._pendingFeatures = null;
    }
  }

  /**
   * Create/recreate GPU resources from prepared data.
   * Call during warp HYPER phase (hidden behind tunnel) or at startup.
   */
  activate() {
    // Safety: if an interrupted warp left origin layers alive, dispose them first
    this._disposeOriginLayers();
    // Dispose old layers
    this._clearScene();

    const data = this._pendingData;

    if (data) {
      // Galaxy-aware mode — procedural glow from real-time density integration
      this._glowLayer = new ProceduralGlowLayer(
        this._glowRadius,
        this._brightnessConfig.glow,
        this._galacticMap,
      );
      if (this._playerPos) {
        this._glowLayer.setPlayerPosition(this._playerPos);
      }
      // Debug: expose glow layer for console testing
      window._glowLayer = this._glowLayer;

      // Restore target marker if one was pending (set before activate recreated the layer)
      if (this._pendingTargetMarker && this._glowLayer) {
        this._glowLayer.setTargetMarker(this._pendingTargetMarker);
      }

      // Sky features (nebulae, clusters, etc.)
      this._featureLayer = new SkyFeatureLayer(this._brightnessConfig.features);
      if (this._pendingFeatures && this._pendingFeatures.length > 0) {
        this._featureLayer.setFeatures(this._pendingFeatures, this._playerPos);
        // Nebula billboards now handle their own glow absorption via
        // premultiplied alpha + Beer-Lambert — no glow shader absorption needed.
      }

      this._starfieldLayer = new StarfieldLayer(
        data,
        this._starfieldRadius,
        this._brightnessConfig.stars
      );
    } else {
      // Legacy mode — random starfield, no glow, no features
      this._starfieldLayer = new StarfieldLayer(
        this._starDensity,
        this._starfieldRadius,
        this._brightnessConfig.stars
      );
    }

    // Add to scene in render order: glow (0) → absorption (1) → emission (2) → stars (3)
    if (this._glowLayer) {
      this._glowLayer.mesh.renderOrder = 0;
      this._scene.add(this._glowLayer.mesh);
    }
    if (this._featureLayer) {
      this._scene.add(this._featureLayer.mesh);
    }
    this._starfieldLayer.mesh.renderOrder = 3;
    this._scene.add(this._starfieldLayer.mesh);

    this._pendingData = null;
    this._pendingFeatures = null;
  }

  /**
   * Per-frame update — moves sky sphere with camera.
   * @param {THREE.Camera} camera
   * @param {number} deltaTime
   */
  update(camera, deltaTime) {
    if (this._starfieldLayer) {
      this._starfieldLayer.update(camera.position);
    }
    if (this._glowLayer) {
      this._glowLayer.update(camera.position);
    }
    if (this._featureLayer) {
      this._featureLayer.update(camera.position);
    }
    // Keep origin sky spheres locked to the camera during the crossover —
    // otherwise they'd fall behind as the camera flies forward through HYPER.
    if (this._crossoverActive) {
      if (this._originStarfieldLayer) this._originStarfieldLayer.update(camera.position);
      if (this._originGlowLayer)      this._originGlowLayer.update(camera.position);
      if (this._originFeatureLayer)   this._originFeatureLayer.update(camera.position);
    }
  }

  /**
   * Get ambient tint from being inside a galactic feature (e.g. nebula).
   * @returns {{ r: number, g: number, b: number, strength: number }|null}
   */
  getAmbientTint() {
    return this._featureLayer?.ambientTint ?? null;
  }

  /**
   * Returns the Three.js scene for RetroRenderer to render as Pass 1.
   * @returns {THREE.Scene}
   */
  getScene() {
    return this._scene;
  }

  // ── Target marker (persists across activate) ──

  setTargetMarker(pos) {
    this._pendingTargetMarker = pos || null;
    if (this._glowLayer) {
      this._glowLayer.setTargetMarker(pos);
    }
  }

  clearTargetMarker() {
    this._pendingTargetMarker = null;
    if (this._glowLayer) {
      this._glowLayer.setTargetMarker(null);
    }
  }

  // ── Warp interface (delegates to starfield layer) ──

  setWarpUniforms(foldAmount, brightness, riftCenterNDC) {
    if (this._starfieldLayer) {
      this._starfieldLayer.setWarpUniforms(foldAmount, brightness, riftCenterNDC);
    }
  }

  // ── Dual-layer warp tunnel lifecycle ──
  //
  // During a system-swap warp, the old (origin) sky layers are kept alive
  // alongside the newly built (destination) layers. The tunnel warp deforms
  // both sets; the crossover uniforms clip origin stars ahead of a sweeping
  // plane and destination stars behind it, producing a blended transition
  // zone instead of a hard cut at tunnel destruction.
  //
  //   beginWarpTransition()     — at onSwapSystem (end of FOLD): build new
  //                               destination layers from _pendingData,
  //                               move current layers to origin slots,
  //                               and configure the crossover.
  //   completeWarpTransition()  — at onComplete (after EXIT): dispose origin
  //                               layers and reset the crossover state.

  /**
   * Build destination layers from _pendingData WITHOUT disposing the current
   * layers. The current layers are moved into origin slots and continue to
   * render (still clipped/deformed by the tunnel uniforms) until the warp
   * completes.
   */
  beginWarpTransition() {
    // Safety: if a previous warp never completed (interrupted), discard
    // those origin layers before starting a new transition.
    this._disposeOriginLayers();

    // Move current layers into the origin slots. They stay in _scene;
    // we just stop referencing them from the primary fields.
    this._originStarfieldLayer = this._starfieldLayer;
    this._originGlowLayer      = this._glowLayer;
    this._originFeatureLayer   = this._featureLayer;
    this._starfieldLayer = null;
    this._glowLayer = null;
    this._featureLayer = null;

    const data = this._pendingData;

    if (data) {
      this._glowLayer = new ProceduralGlowLayer(
        this._glowRadius,
        this._brightnessConfig.glow,
        this._galacticMap,
      );
      if (this._playerPos) {
        this._glowLayer.setPlayerPosition(this._playerPos);
      }
      window._glowLayer = this._glowLayer;
      if (this._pendingTargetMarker && this._glowLayer) {
        this._glowLayer.setTargetMarker(this._pendingTargetMarker);
      }

      this._featureLayer = new SkyFeatureLayer(this._brightnessConfig.features);
      if (this._pendingFeatures && this._pendingFeatures.length > 0) {
        this._featureLayer.setFeatures(this._pendingFeatures, this._playerPos);
      }

      this._starfieldLayer = new StarfieldLayer(
        data,
        this._starfieldRadius,
        this._brightnessConfig.stars
      );
    } else {
      // Legacy/random destination — unusual during warp, but handle it.
      this._starfieldLayer = new StarfieldLayer(
        this._starDensity,
        this._starfieldRadius,
        this._brightnessConfig.stars
      );
    }

    if (this._glowLayer) {
      this._glowLayer.mesh.renderOrder = 0;
      this._scene.add(this._glowLayer.mesh);
    }
    if (this._featureLayer) {
      this._scene.add(this._featureLayer.mesh);
    }
    this._starfieldLayer.mesh.renderOrder = 3;
    this._scene.add(this._starfieldLayer.mesh);

    // Configure crossover — origin clips ahead, destination clips behind,
    // the sweeping plane starts far in front and moves behind the camera.
    if (this._originStarfieldLayer) {
      this._originStarfieldLayer.setClipSide(0);
      this._originStarfieldLayer.setCrossoverAlong(600);
    }
    this._starfieldLayer.setClipSide(1);
    this._starfieldLayer.setCrossoverAlong(600);

    this._crossoverActive = true;

    this._pendingData = null;
    this._pendingFeatures = null;
  }

  /**
   * Dispose origin layers and reset crossover to a permissive state so the
   * destination starfield renders without clipping.
   */
  completeWarpTransition() {
    this._disposeOriginLayers();
    this._crossoverActive = false;
    if (this._starfieldLayer) {
      this._starfieldLayer.setClipSide(0);
      this._starfieldLayer.setCrossoverAlong(1e6);
    }
  }

  _disposeOriginLayers() {
    if (this._originGlowLayer) {
      this._scene.remove(this._originGlowLayer.mesh);
      this._originGlowLayer.dispose();
      this._originGlowLayer = null;
    }
    if (this._originFeatureLayer) {
      this._scene.remove(this._originFeatureLayer.mesh);
      this._originFeatureLayer.dispose();
      this._originFeatureLayer = null;
    }
    if (this._originStarfieldLayer) {
      this._scene.remove(this._originStarfieldLayer.mesh);
      this._originStarfieldLayer.dispose();
      this._originStarfieldLayer = null;
    }
  }

  // ── Tunnel / crossover delegators ──
  // When _crossoverActive, origin + destination layers are both driven so
  // the deformation and clip sweep stay in lockstep.

  setTunnelPhase(v) {
    if (this._starfieldLayer) this._starfieldLayer.setTunnelPhase(v);
    if (this._glowLayer && this._glowLayer.setTunnelPhase) this._glowLayer.setTunnelPhase(v);
    if (this._crossoverActive) {
      if (this._originStarfieldLayer) this._originStarfieldLayer.setTunnelPhase(v);
      if (this._originGlowLayer && this._originGlowLayer.setTunnelPhase) this._originGlowLayer.setTunnelPhase(v);
    }
  }

  setTunnelForward(vec3) {
    if (this._starfieldLayer) this._starfieldLayer.setTunnelForward(vec3);
    if (this._glowLayer && this._glowLayer.setTunnelForward) this._glowLayer.setTunnelForward(vec3);
    if (this._crossoverActive) {
      if (this._originStarfieldLayer) this._originStarfieldLayer.setTunnelForward(vec3);
      if (this._originGlowLayer && this._originGlowLayer.setTunnelForward) this._originGlowLayer.setTunnelForward(vec3);
    }
  }

  setTunnelScroll(v) {
    if (this._starfieldLayer) this._starfieldLayer.setTunnelScroll(v);
    if (this._crossoverActive && this._originStarfieldLayer) {
      this._originStarfieldLayer.setTunnelScroll(v);
    }
  }

  setTunnelRadius(v) {
    if (this._starfieldLayer) this._starfieldLayer.setTunnelRadius(v);
    if (this._glowLayer && this._glowLayer.setTunnelRadius) this._glowLayer.setTunnelRadius(v);
    if (this._crossoverActive) {
      if (this._originStarfieldLayer) this._originStarfieldLayer.setTunnelRadius(v);
      if (this._originGlowLayer && this._originGlowLayer.setTunnelRadius) this._originGlowLayer.setTunnelRadius(v);
    }
  }

  setTunnelLength(v) {
    if (this._starfieldLayer) this._starfieldLayer.setTunnelLength(v);
    if (this._crossoverActive && this._originStarfieldLayer) {
      this._originStarfieldLayer.setTunnelLength(v);
    }
  }

  setCrossoverAlong(v) {
    if (this._starfieldLayer) this._starfieldLayer.setCrossoverAlong(v);
    if (this._crossoverActive && this._originStarfieldLayer) {
      this._originStarfieldLayer.setCrossoverAlong(v);
    }
  }

  setClipSide(side) {
    if (this._starfieldLayer) this._starfieldLayer.setClipSide(side);
    if (this._crossoverActive && this._originStarfieldLayer) {
      this._originStarfieldLayer.setClipSide(side);
    }
  }

  // ── Star selection interface (delegates to starfield layer) ──

  findNearestStar(rayDirection) {
    return this._starfieldLayer?.findNearestStar(rayDirection) ?? null;
  }

  getRandomVisibleStar(cameraForward) {
    return this._starfieldLayer?.getRandomVisibleStar(cameraForward) ?? null;
  }

  getGalaxyStarForIndex(index) {
    return this._starfieldLayer?.getGalaxyStarForIndex(index) ?? null;
  }

  /**
   * Get the full starfield entry for an index — star, feature, or null.
   * Used by warp routing to determine what was clicked.
   * @param {number} index
   * @returns {{ starData?, isFeature?, featureType?, featureData? }|null}
   */
  getEntryForIndex(index) {
    return this._starfieldLayer?.getEntryForIndex(index) ?? null;
  }

  // ── Brightness tuning ──

  /**
   * Adjust brightness ranges at runtime (e.g. for testing).
   * @param {'glow'|'features'|'stars'} layer
   * @param {{ min?: number, max?: number }} range
   */
  setBrightnessRange(layer, range) {
    const config = this._brightnessConfig[layer];
    if (!config) return;
    if (range.min !== undefined) config.min = range.min;
    if (range.max !== undefined) config.max = range.max;

    // Propagate to live GPU uniforms
    if (layer === 'glow' && this._glowLayer) {
      this._glowLayer.setBrightnessMax(config.max);
    }
    if (layer === 'stars' && this._starfieldLayer) {
      const u = this._starfieldLayer.mesh.material.uniforms;
      u.uBrightnessMin.value = config.min;
      u.uBrightnessMax.value = config.max;
    }
  }

  // ── Lifecycle ──

  _clearScene() {
    if (this._glowLayer) {
      this._scene.remove(this._glowLayer.mesh);
      this._glowLayer.dispose();
      this._glowLayer = null;
    }
    if (this._featureLayer) {
      this._scene.remove(this._featureLayer.mesh);
      this._featureLayer.dispose();
      this._featureLayer = null;
    }
    if (this._starfieldLayer) {
      this._scene.remove(this._starfieldLayer.mesh);
      this._starfieldLayer.dispose();
      this._starfieldLayer = null;
    }
  }

  dispose() {
    this._disposeOriginLayers();
    this._crossoverActive = false;
    this._clearScene();
    if (this._glowManager) {
      this._glowManager.dispose();
    }
  }
}
