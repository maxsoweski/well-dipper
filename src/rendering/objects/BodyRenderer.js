import * as THREE from 'three';
import { Planet } from '../../objects/Planet.js';
import { Moon } from '../../objects/Moon.js';
import { KNOWN_BODY_PROFILES } from '../../data/KnownBodyProfiles.js';
import { createTexturedBodyMaterial } from '../shaders/TexturedBodyShader.js';
import { LODColorExtractor } from '../LODColorExtractor.js';
// The relief octave ramp is the LAB'S law, imported rather than re-derived: lodRampOf is
// smoothstep(20,6,distanceInRadii) and autoOctaves is mix(4,9,ramp). planet-lod-lab-core.js is a
// pure module (45 exports, zero imports, no top-level side effects) so this tree-shakes to the two
// functions. Copying the law instead would be the same mistake the hash3/noised/fbmd copy was.
import { lodRampOf, autoOctaves } from '../../../planet-lod-lab-core.js';
import { updateLabPlanetMaterial, isLabPlanetMaterial } from '../LabPlanetMaterial.js';

/**
 * BodyRenderer — unified planet/moon renderer with physics data awareness.
 *
 * Currently delegates to the existing Planet.js and Moon.js renderers
 * (which have 949 lines of working shader code for 11+ planet types).
 * This wrapper provides:
 *
 *   1. A unified interface for LODManager (setLOD, getRadius, etc.)
 *   2. Physics data consumption (composition, atmosphere, surface history)
 *   3. LOD1 color matching — when a body has LOD2 textures, the procedural
 *      shader at LOD1 is tuned to approximate the textured look, reducing
 *      the visual pop on transition
 *   4. A migration path — internals can be replaced incrementally
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
 *   2 — Close-up: enhanced detail (terrain, atmosphere scattering)
 *
 * LOD downscaling pipeline (LOD2 → LOD1):
 *   Known bodies with textures get their LOD1 procedural shader retuned:
 *   - baseColor/accentColor are overridden to match the texture's dominant colors
 *   - noiseScale is adjusted to match heightmap frequency content
 *   - Values come from KnownBodyProfiles.lod1Overrides (pre-computed) or
 *     LODColorExtractor.extract() (runtime, async)
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
      // Store the actual lightDir refs so the textured material can share them
      this._moonLightDir = lightDir;
      this._moonLightDir2 = lightDir2;
    }

    // Expose the mesh for scene management
    this.mesh = this._delegate.mesh;

    // Expose surface for raycasting (Planet.js stores it)
    this.surface = this._delegate.surface;

    // Expose ring for Planet (if any)
    this.ring = this._delegate.ring || null;

    // Expose light direction refs — Planet.js stores them, Moon.js doesn't
    this._lightDir = this._delegate._lightDir || this._moonLightDir || null;
    this._lightDir2 = this._delegate._lightDir2 || this._moonLightDir2 || null;

    // ── Known body texture handling ──
    // Decision (2026-03-27): known bodies with profiles skip procedural
    // entirely. Load textures at startup, always render textured.
    // LOD1 color matching still applied as fallback while textures load.
    const profileId = this.data.profileId;
    this._isAlwaysTextured = false;
    if (profileId && KNOWN_BODY_PROFILES[profileId]) {
      this._isAlwaysTextured = true;
      // Apply LOD1 overrides as fallback (shown while textures load)
      this._applyLOD1Overrides();
      // Start loading textures immediately (don't wait for LOD2)
      this._loadTexturedMaterial(profileId);
    }
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
    const prevTier = this._currentLOD;
    this._currentLOD = tier;

    // Always-textured bodies: textures already loading from constructor.
    // Never swap back to procedural — textured material is the only look.
    if (this._isAlwaysTextured) return;

    // Procedural-only bodies: LOD2 triggers texture load (if profile exists)
    if (tier === 2 && !this._texturedMaterial) {
      const profileId = this.data.profileId;
      if (profileId && KNOWN_BODY_PROFILES[profileId]) {
        this._loadTexturedMaterial(profileId);
      }
    }

    // Swap material based on tier
    if (tier === 2 && this._texturedMaterial) {
      this._swapToTextured();
    } else if (prevTier === 2 && tier < 2) {
      this._swapToProcedural();
    }

    // Update lodLevel uniform on procedural shader (for LOD2 detail)
    this._updateProceduralLODLevel(tier);
  }

  /**
   * Set the lodLevel uniform on the procedural shader material.
   * This controls enhanced detail (craters, extra noise octaves) in the
   * Moon.js / Planet.js shaders when the camera is close.
   * @private
   */
  _updateProceduralLODLevel(tier) {
    const surface = this._delegate.surface || this._delegate.mesh;
    if (!surface?.material?.uniforms?.lodLevel) return this._noteLabSkip('lodLevel', surface);
    surface.material.uniforms.lodLevel.value = tier;
  }

  /**
   * Ramp the fbmd relief octave count with distance — the game's half of the lab's LOD ramp.
   *
   * ⚠ DELIBERATELY NOT KEYED ON THE LOD TIER. setLOD's tier is discrete (0/1/2) and early-returns
   * when unchanged, so driving octaves from it would step 4 -> 9 in one frame and POP: five octaves
   * of relief appearing at once. This takes the CONTINUOUS distance-in-radii that LODManager
   * already computes for the tier test and runs it through the lab's own smoothstep, so the count
   * is fractional and moves smoothly. fbmd is built for exactly that — its trailing-octave weight
   * `clamp(octaves - i, 0, 1)` fades the newest octave in from zero, which is what makes a
   * fractional count pop-free rather than merely non-integer.
   *
   * Cost is bounded by geometry, not by body count: lodRampOf is smoothstep(20,6,d), so a body
   * pays more than the flat 4.0 only inside 20 radii, and the full 9 only inside 6. Distant bodies
   * are left at exactly RELIEF_OCTAVES and so are bit-identical to before this existed.
   *
   * @param {number} distanceRadii — camera distance to the body, in body radii
   */
  setReliefDetail(distanceRadii, cameraWorldPos) {
    const surface = this._delegate.surface || this._delegate.mesh;
    // ── LAYER 2 item 3 — the lab material rides the SAME distance, through the same law ──
    // Ordered before the early-return below on purpose: the lab material has no `uReliefOctaves`
    // (its detail uniforms are uOctaves/uLodRamp), so the guard would have skipped it exactly the
    // way the game's clock guard skipped its uTime. Two differently-named uniforms, one silent
    // no-op each — that pairing is what left the lab shader pinned at 4 of 9 octaves in-game.
    // cameraWorldPos rides along here rather than in Planet.updateRender because THIS is the
    // per-frame path that already holds the camera (LODManager.update), and inventing a third
    // traversal to carry one vector is how seams multiply.
    updateLabPlanetMaterial(surface?.material, { distanceRadii, cameraWorldPos, mesh: surface });

    const u = surface?.material?.uniforms?.uReliefOctaves;
    if (!u) return;                                  // moons, textured swaps, gas variants
    const next = autoOctaves(lodRampOf(distanceRadii));
    if (u.value !== next) u.value = next;
  }

  // ── PLAN §4 Step 6 — the two writers in THIS file that go silent on a swapped body ─────────────
  //
  // ⛔ THE SCAR THIS ANSWERS IS ALREADY IN THIS FILE, TWICE OVER. `setReliefDetail` above carries
  // the note: two per-frame writers guarded on uniform NAMES the lab material does not declare
  // (`time` vs `uTime`, `uReliefOctaves` vs `uOctaves`) each fell through in silence, and "a guard
  // that no-ops on the material you are trying to drive looks exactly like a feature that does not
  // exist". Step 6's flag makes that happen again to two MORE writers, both in this class and both
  // named in PLAN 6b's lost-feature table:
  //
  //   `lodLevel`   — src/rendering/objects/BodyRenderer.js:181 `surface.material.uniforms.lodLevel.value = tier`,
  //                  guarded on `u.lodLevel`. The table calls it near-harmless because no shader
  //                  reads it; near-harmless is a claim, and a claim wants a witness.
  //   `baseColor`  — `_setProceduralColors`, guarded on `u.baseColor`. This is the LOD1 colour match
  //                  that keeps a body from popping when its textures arrive.
  //
  // Neither loss can currently fire together with a swap — both need a `profileId`, and
  // `labPipelineAdmits` refuses any body that has one — so this is a WITNESS, not a fix, and it
  // costs one `isLabPlanetMaterial` call on two paths that run at LOD transitions and at texture
  // load, never per frame. It exists so 6b's ledger can be re-derived by RUNNING rather than by
  // reading, which is the method 6b's own ⛔ demands, and so that the day one of these DOES fire the
  // count is on the object instead of in a document.
  _noteLabSkip(site, surface) {
    if (!isLabPlanetMaterial(surface?.material)) return;
    if (!this._labSkips) this._labSkips = {};
    this._labSkips[site] = (this._labSkips[site] || 0) + 1;
  }

  /** Per-site counts of writes this class skipped because the surface carries the lab material. */
  get labSkips() { return this._labSkips || {}; }

  /**
   * The lab-pipeline record `Planet._createLabSurface` left on the surface, or null for a legacy
   * body. Instrument E captions read the flag AND ITS SOURCE from here (§12.5 fact 6) rather than
   * re-deriving them, because a caption that re-derives the flag is asserting what it should be
   * reporting — and the default configuration is the one where the flag is OFF.
   */
  get labPipeline() {
    const surface = this._delegate.surface || this._delegate.mesh;
    return surface?.userData?.wd?.lab || null;
  }

  // ── LOD1 ↔ LOD2 downscaling pipeline ──

  /**
   * Apply LOD1 color/noise overrides from the body's profile.
   *
   * Why: When a body has NASA textures at LOD2, the procedural shader at LOD1
   * looks very different (default noise colors vs real surface colors). By
   * overriding the procedural shader's baseColor, accentColor, and noiseScale
   * to match what the texture actually looks like, the LOD1→LOD2 transition
   * becomes much less noticeable.
   *
   * The overrides come from KnownBodyProfiles.lod1Overrides (pre-computed
   * by running LODColorExtractor on the textures). If no pre-computed values
   * exist, we fall back to async extraction at runtime.
   *
   * @private
   */
  _applyLOD1Overrides() {
    const profileId = this.data.profileId;
    if (!profileId) return;

    const profile = KNOWN_BODY_PROFILES[profileId];
    if (!profile) return;

    // Try pre-computed values first (synchronous, preferred)
    const overrides = LODColorExtractor.getPrecomputed(profile);
    if (overrides) {
      this._setProceduralColors(overrides);
      return;
    }

    // No pre-computed values — extract at runtime (async)
    // This path exists for profiles that have textures but no lod1Overrides baked yet.
    if (profile.textures?.diffuse) {
      LODColorExtractor.extract(profile).then((extracted) => {
        if (extracted) {
          this._setProceduralColors(extracted);
        }
      }).catch((err) => {
        console.warn(`LODColorExtractor failed for ${profileId}:`, err.message);
      });
    }
  }

  /**
   * Patch the procedural shader's uniforms with new color/noise values.
   * Only touches uniforms that exist — safe for both Planet.js and Moon.js shaders.
   * @private
   */
  _setProceduralColors(params) {
    const surface = this._delegate.surface || this._delegate.mesh;
    if (!surface?.material?.uniforms) return;

    const u = surface.material.uniforms;

    if (params.baseColor && u.baseColor) {
      u.baseColor.value.set(...params.baseColor);
    } else if (params.baseColor) {
      this._noteLabSkip('baseColor', surface);   // PLAN 6b row "LOD1 procedural colour match"
    }
    if (params.accentColor && u.accentColor) {
      u.accentColor.value.set(...params.accentColor);
    }
    if (params.noiseScale != null && u.noiseScale) {
      u.noiseScale.value = params.noiseScale;
    }

    // Store original colors so we could restore them if needed
    if (!this._originalProceduralColors) {
      this._originalProceduralColors = {
        baseColor: this.data.baseColor ? [...this.data.baseColor] : null,
        accentColor: this.data.accentColor ? [...this.data.accentColor] : null,
        noiseScale: this.data.noiseScale,
      };
    }
  }

  /**
   * Load textures and create the textured material for LOD tier 2.
   */
  _loadTexturedMaterial(profileId) {
    const profile = KNOWN_BODY_PROFILES[profileId];
    if (!profile?.textures?.diffuse) return;

    const loader = new THREE.TextureLoader();
    const starInfo = this._delegate._starInfo || null;

    // Get current light directions from the delegate
    const lightDir = this._lightDir || this._delegate._lightDir || new THREE.Vector3(1, 0, 0);
    const lightDir2 = this._lightDir2 || this._delegate._lightDir2 || null;

    this._texturedMaterial = createTexturedBodyMaterial({
      lightDir,
      lightDir2,
      starInfo,
      heightScale: profile.heightScale ?? 0.04,
      posterizeLevels: profile.posterizeLevels ?? 8.0,
      ditherEdgeWidth: profile.ditherEdgeWidth ?? 0.5,
      clouds: this.data.clouds || null,
      atmosphere: this.data.atmosphere || null,
      planetRadius: this.data.radius || 1.0,
      cloudStyle: profile.cloudStyle ?? 0,
    });

    // Load diffuse texture
    loader.load(profile.textures.diffuse, (tex) => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      // NearestFilter preserves retro pixel aesthetic even with real photos
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      this._texturedMaterial.uniforms.diffuseMap.value = tex;
      this._texturedMaterial.uniforms.hasTextures.value = 1.0;
      // Always-textured: swap immediately regardless of LOD tier
      // Procedural-only: swap only if at LOD 2
      if (this._isAlwaysTextured || this._currentLOD === 2) {
        this._swapToTextured();
      }
    });

    // Load heightmap if available
    if (profile.textures.heightmap) {
      loader.load(profile.textures.heightmap, (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        this._texturedMaterial.uniforms.heightMap.value = tex;
        this._texturedMaterial.uniforms.hasHeightMap.value = 1.0;
      });
    }
  }

  _swapToTextured() {
    if (!this._texturedMaterial) return;
    const surface = this._delegate.surface || this._delegate.mesh;
    if (!surface) return;
    // Save procedural material for swap-back
    if (!this._proceduralMaterial) {
      this._proceduralMaterial = surface.material;
    }
    if (this._texturedMaterial.uniforms.hasTextures.value > 0.5) {
      surface.material = this._texturedMaterial;
    }
  }

  _swapToProcedural() {
    if (!this._proceduralMaterial) return;
    const surface = this._delegate.surface || this._delegate.mesh;
    if (!surface) return;
    surface.material = this._proceduralMaterial;
  }

  // ── Delegate passthrough ──

  /**
   * Sim-tick advance — delegates to underlying body's updateSim (Phase 3
   * wrap decomp). Falls back to legacy `update(...)` if the delegate
   * hasn't been migrated; logs once so the gap is visible.
   */
  updateSim(...args) {
    if (this._delegate.updateSim) {
      this._delegate.updateSim(...args);
    } else if (this._delegate.update) {
      // Legacy delegate — calls update() with sim dt for both halves.
      // Render half (texture-baked time uniform) is then double-fired
      // when updateRender runs, so a delegate that hasn't migrated will
      // animate at 2× rate. Visible signal that migration is incomplete.
      if (!this._sawLegacyUpdateWarn) {
        this._sawLegacyUpdateWarn = true;
        console.warn('[BodyRenderer] delegate has no updateSim — legacy update() path');
      }
      this._delegate.update(...args);
    }
  }

  /**
   * Render-tick advance — texture-baked material time uniform (animated
   * clouds) + delegate passthrough for sub-class render-half work
   * (Planet/Moon expose updateRender for procedural-material time
   * uniforms).
   */
  updateRender(renderDt) {
    if (this._delegate.updateRender) {
      this._delegate.updateRender(renderDt);
    }
    // Texture-baked clouds shader time — render-classified per Phase 3.
    if (this._texturedMaterial?.uniforms?.time) {
      this._texturedMaterial.uniforms.time.value += renderDt;
    }
  }

  /**
   * Convenience orchestrator: invokes updateSim + updateRender with the
   * same dt for both. Use the split methods for sim/render-decoupled
   * call paths; use this for legacy callers (gallery preview mode).
   */
  update(deltaTime, ...args) {
    this.updateSim(deltaTime, ...args);
    this.updateRender(deltaTime);
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
    // The delegate disposes whichever material is currently assigned to the
    // surface (textured after a swap, procedural otherwise). We own the rest:
    // the textures we loaded (three.js does NOT free a material's textures on
    // material.dispose()) and the saved material the delegate won't touch.
    const surface = this._delegate.surface || this._delegate.mesh || null;
    const liveMaterial = surface ? surface.material : null;
    const tm = this._texturedMaterial;

    if (tm?.uniforms) {
      tm.uniforms.diffuseMap?.value?.dispose?.();
      tm.uniforms.heightMap?.value?.dispose?.();
    }

    if (this._delegate.dispose) {
      this._delegate.dispose();
    }

    // Dispose the saved materials the delegate didn't (the non-live one).
    if (tm && tm !== liveMaterial) tm.dispose();
    if (this._proceduralMaterial && this._proceduralMaterial !== liveMaterial) {
      this._proceduralMaterial.dispose();
    }
  }
}
