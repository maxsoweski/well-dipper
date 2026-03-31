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

    // Update procedural glow with new position (if already activated)
    if (this._glowLayer && this._glowLayer.setPlayerPosition) {
      this._glowLayer.setPlayerPosition(playerPos);
    }

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
   * Create/recreate GPU resources from prepared data.
   * Call during warp HYPER phase (hidden behind tunnel) or at startup.
   */
  activate() {
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
    this._clearScene();
    if (this._glowManager) {
      this._glowManager.dispose();
    }
  }
}
