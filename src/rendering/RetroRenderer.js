import * as THREE from 'three';

/**
 * RetroRenderer — dual-resolution multi-pass compositor.
 *
 * The starfield renders at FULL resolution (tiny crisp star points).
 * Scene objects (planets, stars, moons, etc.) render at LOW resolution
 * (pixelScale 3 = each render pixel covers 3×3 screen pixels).
 *
 * An optional HUD layer (system map) renders at its own small resolution
 * and gets composited into the bottom-right corner of the screen.
 *
 * A composite pass blends them: black scene pixels (empty space) reveal
 * the high-res starfield behind them, while colored scene pixels take
 * priority. The HUD overlays on top with a subtle dark background.
 *
 * During warp transitions, the composite shader handles:
 * - Fold portal (radial opening with chromatic aberration at edge)
 * - Scene fade-out (sceneFade uniform)
 * - Hyperspace 3D tunnel (ray-cylinder intersection, visible through portal)
 * - Exit reveal (fizzing dithered hole opening in tunnel)
 *
 * Dithering is NOT done here. Each object handles its own dithering
 * in its fragment shader for a more authentic retro look.
 */
export class RetroRenderer {
  constructor(canvas, scene, camera) {
    this.canvas = canvas;
    this.scene = scene;
    this.camera = camera;
    this.pixelScale = 3; // Each render pixel = 3×3 screen pixels

    // Separate scene for the starfield (rendered at full resolution)
    // Legacy: used directly when no SkyRenderer is set.
    // New: SkyRenderer owns the sky scene via setSkyRenderer().
    this.starfieldScene = new THREE.Scene();
    this._skyRenderer = null;

    // HUD (system map) — set via setHud()
    this._hudScene = null;
    this._hudCamera = null;
    this._hudSize = 320;   // HUD render target resolution (square)
    this._hudFrac = 0.255; // HUD width as fraction of screen width

    // ── WebGL Renderer ──
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      logarithmicDepthBuffer: true,
      stencil: true,
    });
    // Phase 2 of welldipper-scene-inspection-layer: stop three.js from auto-
    // resetting the renderer.info aggregates each render() call. The
    // inspection layer reads info.calls/triangles to assert per-phase budgets;
    // it requires non-zero values that survive into the snapshot. Hosts that
    // need per-frame resets call this.renderer.info.reset() explicitly.
    this.renderer.info.autoReset = false;
    this.renderer.setPixelRatio(1);
    this.renderer.autoClear = false; // We manage clearing per-pass

    // Render targets (created in resize())
    this.bgTarget = null;    // Full-res starfield
    this.sceneTarget = null; // Low-res scene objects
    this.hudTarget = null;   // Small HUD overlay

    // ── Composite pass (blends starfield + scene + HUD) ──
    this._setupComposite();

    this.resize();
  }

  /**
   * Set a SkyRenderer to own the sky background pass.
   * When set, the SkyRenderer's scene is used instead of this.starfieldScene.
   * @param {import('./SkyRenderer.js').SkyRenderer} skyRenderer
   */
  setSkyRenderer(skyRenderer) {
    this._skyRenderer = skyRenderer;
  }

  /**
   * Get the scene used for the sky pass (SkyRenderer scene or legacy starfieldScene).
   * @returns {THREE.Scene}
   */
  getSkyScene() {
    if (this._skyRenderer) {
      return this._skyRenderer.getScene() ?? this.starfieldScene;
    }
    return this.starfieldScene;
  }

  /**
   * Set the HUD scene and camera (e.g. SystemMap).
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   */
  setHud(scene, camera) {
    this._hudScene = scene;
    this._hudCamera = camera;
  }

  /**
   * Convert a screen click to HUD texture UV, or null if outside the circular HUD.
   * @param {number} clientX — mouse X in window pixels
   * @param {number} clientY — mouse Y in window pixels
   * @returns {{ u: number, v: number } | null}
   */
  getHudUV(clientX, clientY) {
    if (!this._hudScene) return null;

    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;

    // Screen UV (0-1, origin bottom-left, matching shader vUv)
    const uvX = clientX / w;
    const uvY = 1 - clientY / h;

    // HUD rect in UV space (read from the dynamic shader uniform)
    const rect = this._compositeMesh.material.uniforms.hudRect.value;
    const hudX = rect.x;
    const hudY = rect.y;
    const hudW = rect.z;
    const hudH = rect.w * aspect;

    // Circle test (matches shader logic)
    const cx = hudX + hudW * 0.5;
    const cy = hudY + hudH * 0.5;
    const radius = hudW * 0.5;
    let dx = uvX - cx;
    let dy = uvY - cy;
    dy *= (hudW / hudH);  // aspect correction to match shader
    if (dx * dx + dy * dy >= radius * radius) return null;

    // Convert to HUD texture UV (0-1 within the HUD rect)
    const u = (uvX - hudX) / hudW;
    const v = (uvY - hudY) / hudH;
    if (u < 0 || u > 1 || v < 0 || v > 1) return null;

    return { u, v };
  }

  /**
   * Set the color palette mode.
   * @param {number} palette  0=default, 1=mono, 2=amber, 3=green, 4=blue,
   *   5=gameboy, 6=cga, 7=sepia, 8=virtualboy, 9=inverted
   */
  setColorPalette(palette) {
    this._compositeMesh.material.uniforms.uColorPalette.value = palette;
  }

  /**
   * Update time-based uniforms (call each frame).
   * @param {number} time — elapsed time in seconds
   */
  setTime(time) {
    this._compositeMesh.material.uniforms.uTime.value = time;
  }

  /**
   * Set film grain strength. 0 = off, 0.045 = default subtle static.
   * @param {number} strength
   */
  setGrainStrength(strength) {
    this._compositeMesh.material.uniforms.uGrainStrength.value = strength;
  }

  /**
   * Set warp-related uniforms (called by main.js during warp).
   * @param {number} sceneFade    0 = scene visible, 1 = scene hidden
   * @param {number} whiteFlash   0 = no flash, 1 = full white
   * @param {number} hyperPhase   0 = no hyperspace, 1 = full hyperspace
   * @param {number} hyperTime    elapsed time for hyperspace animation
   * @param {number} foldGlow     0 = no glow, 1 = full bright core
   * @param {number} exitReveal   0 = no opening, 1 = full opening (exit)
   * @param {THREE.Vector2} [riftCenterUV] — rift center in UV space (0-1)
   */
  setWarpUniforms(sceneFade, whiteFlash, hyperPhase, hyperTime, foldGlow, exitReveal, riftCenterUV) {
    const u = this._compositeMesh.material.uniforms;
    u.uSceneFade.value = sceneFade;
    u.uWhiteFlash.value = whiteFlash;
    u.uHyperPhase.value = hyperPhase;
    u.uHyperTime.value = hyperTime;
    u.uFoldGlow.value = foldGlow;
    u.uExitReveal.value = exitReveal;
    if (riftCenterUV) {
      u.uRiftCenter.value.copy(riftCenterUV);
    }
  }

  /** Set tunnel-related uniforms for the composite shader hyperspace pass. */
  setTunnelUniforms(recession, bridgeMix, originSeed, destSeed) {
    const u = this._compositeMesh.material.uniforms;
    u.uTunnelRecession.value = recession;
    u.uHyperBridgeMix.value = bridgeMix;
    if (originSeed) u.uHyperOriginSeed.value.copy(originSeed);
    if (destSeed) u.uHyperDestSeed.value.copy(destSeed);
  }

  /** Set portal screen-space lensing uniforms (called when 3D portal is visible). */
  setPortalLensing(centerUV, screenRadius, strength) {
    const u = this._compositeMesh.material.uniforms;
    if (centerUV) u.uPortalCenter.value.copy(centerUV);
    u.uPortalScreenRadius.value = screenRadius;
    if (strength !== undefined) u.uPortalLensStrength.value = strength;
  }

  /**
   * Set warp target bracket uniforms (called by main.js each frame).
   * @param {THREE.Vector2} uv    — screen UV of selected star (0-1)
   * @param {number} blink        — 0 or 1 (blink on/off)
   * @param {number} size         — bracket size in pixels (0 = hidden)
   */
  setTargetUniforms(uv, blink, size) {
    const u = this._compositeMesh.material.uniforms;
    if (uv) {
      u.uTargetUV.value.copy(uv);
    }
    u.uTargetBlink.value = blink;
    u.uTargetSize.value = size;
  }

  /**
   * Build the fullscreen composite quad + shader.
   * Samples all render targets and composites them.
   */
  _setupComposite() {
    const geometry = new THREE.PlaneGeometry(2, 2);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        bgTexture: { value: null },
        sceneTexture: { value: null },
        hudTexture: { value: null },
        hudRect: { value: new THREE.Vector4(0.73, 0.02, 0.255, 0.255) },
        hudEnabled: { value: 0 },
        resolution: { value: new THREE.Vector2(1, 1) },
        // Warp uniforms
        uSceneFade: { value: 0.0 },
        uWhiteFlash: { value: 0.0 },
        uHyperPhase: { value: 0.0 },
        uHyperTime: { value: 0.0 },
        uFoldGlow: { value: 0.0 },
        uExitReveal: { value: 0.0 },
        uTunnelRecession: { value: 0.0 },              // 0 during HYPER, 0→1 during EXIT (walls expand)
        uHyperBridgeMix: { value: 0.0 },               // 0 = origin stars, 1 = destination stars
        uHyperOriginSeed: { value: new THREE.Vector3(123.34, 456.21, 45.32) },
        uHyperDestSeed: { value: new THREE.Vector3(271.67, 891.43, 73.11) },
        // Gravitational lensing around the 3D portal (active during FOLD/ENTER)
        uPortalCenter: { value: new THREE.Vector2(0.5, 0.5) },     // portal's screen UV
        uPortalScreenRadius: { value: 0.0 },                       // portal's apparent UV radius (0 = inactive)
        uPortalLensStrength: { value: 0.04 },                      // distortion strength
        uRiftCenter: { value: new THREE.Vector2(0.5, 0.5) },  // UV space (0 to 1)
        // Warp target selection brackets
        uTargetUV: { value: new THREE.Vector2(0.5, 0.5) },    // UV of selected star
        uTargetBlink: { value: 0.0 },                          // 0 = off, 1 = on
        uTargetSize: { value: 0.0 },                           // bracket size in pixels
        // Color palette (0=default, 1=mono, 2=amber, 3=green, 4=blue,
        //   5=gameboy, 6=cga, 7=sepia, 8=virtualboy, 9=inverted)
        uColorPalette: { value: 0 },
        // Film grain / static (retro CRT/camera feel)
        uTime: { value: 0.0 },
        uGrainStrength: { value: 0.045 },  // 0 = off, ~0.04-0.06 = subtle static
      },

      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,

      fragmentShader: /* glsl */ `
        uniform sampler2D bgTexture;
        uniform sampler2D sceneTexture;
        uniform sampler2D hudTexture;
        uniform vec4 hudRect;
        uniform float hudEnabled;
        uniform vec2 resolution;
        // Warp uniforms
        uniform float uSceneFade;
        uniform float uWhiteFlash;
        uniform float uHyperPhase;
        uniform float uHyperTime;
        uniform float uFoldGlow;
        uniform float uExitReveal;
        uniform float uTunnelRecession;
        uniform float uHyperBridgeMix;
        uniform vec3  uHyperOriginSeed;
        uniform vec3  uHyperDestSeed;
        uniform vec2  uPortalCenter;
        uniform float uPortalScreenRadius;
        uniform float uPortalLensStrength;
        uniform vec2 uRiftCenter;
        // Warp target brackets
        uniform vec2 uTargetUV;
        uniform float uTargetBlink;
        uniform float uTargetSize;
        // Color palette
        uniform int uColorPalette;
        // Film grain
        uniform float uTime;
        uniform float uGrainStrength;
        varying vec2 vUv;

        // ── Color palette remapping ──
        // Converts final RGB to the selected palette. Applied as the very
        // last step so it affects everything (scene, starfield, HUD, warp).
        vec3 applyPalette(vec3 col, int palette) {
          if (palette == 0) return col; // default — no remap

          float lum = dot(col, vec3(0.299, 0.587, 0.114));

          // 1: Monochrome
          if (palette == 1) return vec3(lum);

          // 2: Amber CRT
          if (palette == 2) return vec3(lum * 1.0, lum * 0.69, lum * 0.0);

          // 3: Green phosphor
          if (palette == 3) return vec3(lum * 0.0, lum * 1.0, lum * 0.25);

          // 4: Blue phosphor
          if (palette == 4) return vec3(lum * 0.39, lum * 0.71, lum * 1.0);

          // 5: Game Boy (4-shade green)
          if (palette == 5) {
            // 4 colors: darkest to lightest
            vec3 c0 = vec3(0.06, 0.22, 0.06);  // near-black green
            vec3 c1 = vec3(0.19, 0.38, 0.19);  // dark green
            vec3 c2 = vec3(0.55, 0.67, 0.06);  // yellow-green
            vec3 c3 = vec3(0.61, 0.74, 0.06);  // lightest
            if (lum < 0.25) return mix(c0, c1, lum / 0.25);
            if (lum < 0.50) return mix(c1, c2, (lum - 0.25) / 0.25);
            return mix(c2, c3, clamp((lum - 0.5) / 0.5, 0.0, 1.0));
          }

          // 6: CGA (cyan/magenta/white/black)
          if (palette == 6) {
            vec3 c0 = vec3(0.0);                   // black
            vec3 c1 = vec3(0.0, 1.0, 1.0);         // cyan
            vec3 c2 = vec3(1.0, 0.33, 1.0);        // magenta
            vec3 c3 = vec3(1.0);                    // white
            if (lum < 0.25) return mix(c0, c1, lum / 0.25);
            if (lum < 0.50) return mix(c1, c2, (lum - 0.25) / 0.25);
            return mix(c2, c3, clamp((lum - 0.5) / 0.5, 0.0, 1.0));
          }

          // 7: Sepia
          if (palette == 7) {
            return vec3(
              lum * 1.0,
              lum * 0.78,
              lum * 0.57
            );
          }

          // 8: Virtual Boy (red + black)
          if (palette == 8) return vec3(lum * 1.0, lum * 0.0, lum * 0.0);

          // 9: Inverted
          if (palette == 9) return vec3(1.0) - col;

          return col;
        }

        // ── Hyperspace tunnel (procedural starfield walls + recession for EXIT) ──
        // Hash-based starfield textures the cone walls. uTunnelRecession (0 during
        // HYPER, 0→1 during EXIT) scales tunnelR up so walls recede outward.
        // Bridge: uHyperBridgeMix shifts walls from origin → destination star pattern.

        float Hash21H(vec2 p, vec3 seed) {
          p = fract(p * seed.xy);
          p += dot(p, p + seed.z);
          return fract(p.x * p.y);
        }

        float StarH(vec2 uv, float flare) {
          float d = length(uv);
          float m = 0.02 / d;
          float rays = max(0.0, 1.0 - abs(uv.x * uv.y * 1000.0));
          m += rays * flare;
          float c = cos(0.7854), s = sin(0.7854);
          vec2 r = mat2(c, -s, s, c) * uv;
          rays = max(0.0, 1.0 - abs(r.x * r.y * 1000.0));
          m += rays * 0.3 * flare;
          m *= smoothstep(0.6, 0.2, d);
          return m;
        }

        vec3 StarColorH(float rand, float destMix) {
          float hotness = fract(rand * 1603.8);
          vec3 originCol = (hotness < 0.6)
            ? vec3(1.0, hotness / 0.6, hotness * 0.9)
            : vec3(1.0 - (hotness - 0.6) / 0.4, 1.0 - (hotness - 0.6) / 0.4, 1.0);
          vec3 destCol = (hotness < 0.6)
            ? vec3(hotness * 0.9, hotness * 0.95, 1.0)
            : vec3(1.0 - (hotness - 0.6) / 0.4, 0.8, 1.0);
          return mix(originCol, destCol, destMix);
        }

        vec3 StarLayerH(vec2 uv, vec3 seed, float destMix, float circCells, float t) {
          vec3 col = vec3(0.0);
          vec2 gv = fract(uv) - 0.5;
          vec2 id = floor(uv);
          for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
              vec2 offs = vec2(float(x), float(y));
              vec2 cellId = id + offs;
              cellId.x = mod(cellId.x, circCells);
              float n = Hash21H(cellId, seed);
              float n2 = fract(n * 345.32);
              float size = n2;
              vec2 sub = vec2(n, fract(n * 42.0)) - 0.5;
              float flare = smoothstep(0.92, 1.0, size) * 0.6;
              float star = StarH(gv - offs - sub, flare);
              vec3 c = StarColorH(n, destMix);
              star *= 0.75 + 0.25 * sin(t * 2.0 + n * 6.2831);
              col += star * size * c;
            }
          }
          return col;
        }

        vec3 hyperspace(vec2 uv, float time) {
          vec2 centered = uv - 0.5;
          float aspect = resolution.x / resolution.y;
          centered.x *= aspect;

          vec3 rd = normalize(vec3(centered * 1.4, 1.0));

          // Tunnel parameters — radius scales up during EXIT (uTunnelRecession 0→1)
          // Walls "recede outward" for the opening-into-destination feel.
          float tunnelR = 4.0 * (1.0 + uTunnelRecession * 4.0);  // 4 → 20
          float taper = 0.15 * (1.0 - uTunnelRecession * 0.7);    // 0.15 → 0.045
          float speed = time * 12.0;

          float rdXY = length(rd.xy);
          float denom = rdXY + taper * rd.z;
          if (denom < 0.001) {
            return vec3(1.0);
          }
          float tWall = tunnelR / denom;
          vec3 hitPos = rd * tWall;
          float wallZ = hitPos.z;

          float maxZ = tunnelR / taper;
          float depthNorm = clamp(wallZ / maxZ, 0.0, 1.0);

          // ── Procedural starfield on tunnel walls ──
          // Cylindrical UV: theta around tunnel + scrolling Z
          float theta = atan(hitPos.y, hitPos.x);
          float thetaUV = theta / 6.2832 + 0.5;
          float zUV = (wallZ + speed) * 0.05;

          float CIRC_CELLS = 32.0;
          float depthFade = 1.0 - depthNorm * depthNorm * 0.7;

          // Origin starfield
          vec3 colOrigin = vec3(0.0);
          float t = time * 0.02;
          for (float i = 0.0; i < 3.0; i += 1.0) {
            float depth = fract(i / 3.0 + t);
            float scale = mix(1.5, 0.5, depth);
            float fade = depth * smoothstep(1.0, 0.9, depth);
            vec2 uvL = vec2(thetaUV * CIRC_CELLS, zUV * 16.0) * scale + i * 453.2;
            colOrigin += StarLayerH(uvL, uHyperOriginSeed, 0.0, CIRC_CELLS * scale, time) * fade;
          }

          // Destination starfield (different hash seed)
          vec3 colDest = vec3(0.0);
          for (float i = 0.0; i < 3.0; i += 1.0) {
            float depth = fract(i / 3.0 + t);
            float scale = mix(1.5, 0.5, depth);
            float fade = depth * smoothstep(1.0, 0.9, depth);
            vec2 uvL = vec2(thetaUV * CIRC_CELLS, zUV * 16.0) * scale + i * 453.2;
            colDest += StarLayerH(uvL, uHyperDestSeed, 1.0, CIRC_CELLS * scale, time) * fade;
          }

          // Bridge: uHyperBridgeMix sweeps origin → destination during HYPER (0→1)
          vec3 col = mix(colOrigin, colDest, uHyperBridgeMix);

          // Boost stars significantly so they pop on tunnel walls
          col *= 4.0 * depthFade;

          // Very dim wall base only at the very edges (low depthNorm = closer)
          // Avoid swamping stars with a base color
          float baseFade = (1.0 - depthNorm) * (1.0 - depthNorm) * 0.15;
          col += vec3(0.05, 0.06, 0.12) * baseFade;

          // Vanishing point glow (destination star coming through)
          float centerDist = length(centered);
          float centerGlow = smoothstep(0.15, 0.0, centerDist);
          col = mix(col, vec3(1.0, 0.95, 0.9), centerGlow * 0.5);

          return col;
        }

        void main() {
          vec4 bg = texture2D(bgTexture, vUv);
          vec4 scene = texture2D(sceneTexture, vUv);

          // Use alpha to decide what's "scene" vs "empty space".
          // Objects render with alpha=1 (even dark shadows), empty space has alpha=0.
          vec3 result = mix(bg.rgb, scene.rgb, scene.a);

          // ── Warp: scene fade ──
          if (uSceneFade > 0.0) {
            float fadeScene = scene.a * (1.0 - uSceneFade);
            result = mix(bg.rgb, scene.rgb, fadeScene);
          }

          // ── Gravitational lensing around the 3D portal ──
          // When portal is active (radius > 0), distort sky behind it.
          // Static effect — strength is constant, no animation.
          if (uPortalScreenRadius > 0.001) {
            vec2 toPortal = vUv - uPortalCenter;
            float portalAspect = resolution.x / resolution.y;
            vec2 aspectCorrP = vec2(toPortal.x * portalAspect, toPortal.y);
            float dPortal = length(aspectCorrP);
            // Only distort OUTSIDE the portal aperture
            if (dPortal > uPortalScreenRadius) {
              float edgeDist = dPortal - uPortalScreenRadius;
              float softness = 0.04;
              float deflection = uPortalLensStrength / pow(edgeDist + softness, 1.5);
              deflection = min(deflection, 0.25);
              vec2 dirP = length(toPortal) > 0.001 ? normalize(toPortal) : vec2(0.0);
              vec2 lensedUV = clamp(vUv + dirP * deflection, 0.0, 1.0);
              vec4 lensedBg = texture2D(bgTexture, lensedUV);
              vec4 lensedSc = texture2D(sceneTexture, lensedUV);
              float fadeScene2 = lensedSc.a * (1.0 - uSceneFade);
              result = mix(lensedBg.rgb, lensedSc.rgb, fadeScene2);
              // Subtle Einstein ring brightness at the very edge
              float ringGlow = smoothstep(0.04, 0.0, edgeDist) * 0.4;
              result += ringGlow * vec3(0.7, 0.85, 1.0);
            }
          }

          // ── Fold portal: chromatic aberration at portal edge ──
          // Space pinches into a central point; hyperspace is visible THROUGH
          // the portal (rendered in the unified hyperspace block below).
          // CA is applied here so it fringes the normal-space side of the edge.
          float portalRadius = 0.0;
          float portalDist = 0.0;
          if (uFoldGlow > 0.0) {
            vec2 toCenter = vUv - uRiftCenter;
            float portalAspect = resolution.x / resolution.y;
            vec2 aspectCorr = vec2(toCenter.x * portalAspect, toCenter.y);
            portalDist = length(aspectCorr);
            // Portal radius tracks the "fully consumed" fold frontier.
            // In the starfield shader, a star at NDC distance d is fully
            // folded when foldAmount >= d*0.7 + 0.35. Working through the
            // foldGlow derivation: fullyConsumed_ndc = max(0, foldGlow - 0.25).
            // Divide by 2 to convert NDC → UV vertical extent.
            portalRadius = max(0.0, uFoldGlow - 0.25) * 0.5;

            // ── Chromatic aberration at portal edge ──
            vec2 caDir = length(toCenter) > 0.001 ? normalize(toCenter) : vec2(0.0);
            float caOffset = 0.012 * (1.0 + uFoldGlow);
            float edgeProximity = 1.0 - smoothstep(0.0, 0.12, abs(portalDist - portalRadius));
            float caStrength = edgeProximity * uFoldGlow;

            if (caStrength > 0.01) {
              vec2 uvR = vUv + caDir * caOffset;
              vec2 uvB = vUv - caDir * caOffset;

              vec4 bgR = texture2D(bgTexture, uvR);
              vec4 scR = texture2D(sceneTexture, uvR);
              vec4 bgB = texture2D(bgTexture, uvB);
              vec4 scB = texture2D(sceneTexture, uvB);

              float rVal = mix(bgR.r, scR.r, scR.a);
              float bVal = mix(bgB.b, scB.b, scB.a);

              result = mix(result, vec3(rVal, result.g, bVal), caStrength * 0.8);
            }
          }

          // ── HUD overlay (circular, hidden during warp) ──
          if (hudEnabled > 0.5 && uSceneFade < 0.5 && uFoldGlow < 0.3) {
            float aspect = resolution.x / resolution.y;
            float hudW = hudRect.z;
            float hudH = hudRect.w * aspect;
            float hudX = hudRect.x;
            float hudY = hudRect.y;

            // Center of HUD region in UV space
            vec2 hudCenter = vec2(hudX + hudW * 0.5, hudY + hudH * 0.5);
            float hudRadius = hudW * 0.5;

            // Normalized distance from center (aspect-corrected so it's a true circle)
            vec2 delta = vUv - hudCenter;
            delta.y *= (hudW / hudH);  // correct for non-square HUD region
            float dist = length(delta);

            if (dist < hudRadius) {
              // Map UV within the bounding rect for texture sampling
              vec2 hudUV = (vUv - vec2(hudX, hudY)) / vec2(hudW, hudH);
              vec4 hud = texture2D(hudTexture, hudUV);

              // Backdrop is rendered inside the 3D map scene (tilted disc),
              // so no flat backdrop needed here — just composite the HUD.
              result = mix(result, hud.rgb, hud.a);
            }
          }

          // ── Warp target selection brackets ──
          // Green L-shaped corner brackets blink around the selected star.
          // uTargetBlink > 1.5 = lock-on mode (solid square outline).
          // uTargetBlink > 0.5 = normal blink mode (L-brackets).
          // Rendered BEFORE hyperspace so they're hidden behind the tunnel.
          if (uTargetBlink > 0.5 && uTargetSize > 0.0) {
            vec2 targetScreen = uTargetUV * resolution;
            vec2 fragScreen = floor(vUv * resolution);
            vec2 diff = fragScreen - targetScreen;
            float halfSize = uTargetSize * 0.5;
            float thick = 2.0;

            bool onShape = false;

            if (uTargetBlink > 1.5) {
              // ── Lock-on: solid square outline (all 4 edges) ──
              // Top edge
              onShape = onShape || (diff.x >= -halfSize && diff.x <= halfSize
                                 && diff.y >= halfSize - thick && diff.y < halfSize);
              // Bottom edge
              onShape = onShape || (diff.x >= -halfSize && diff.x <= halfSize
                                 && diff.y >= -halfSize && diff.y < -halfSize + thick);
              // Left edge
              onShape = onShape || (diff.x >= -halfSize && diff.x < -halfSize + thick
                                 && diff.y >= -halfSize && diff.y < halfSize);
              // Right edge
              onShape = onShape || (diff.x > halfSize - thick && diff.x <= halfSize
                                 && diff.y >= -halfSize && diff.y < halfSize);
            } else {
              // ── Normal: L-shaped corner brackets ──
              float armLen = uTargetSize * 0.3;
              // Top-left corner (horizontal arm + vertical arm)
              onShape = onShape || (diff.x >= -halfSize && diff.x < -halfSize + armLen
                                 && diff.y >= halfSize - thick && diff.y < halfSize);
              onShape = onShape || (diff.x >= -halfSize && diff.x < -halfSize + thick
                                 && diff.y >= halfSize - armLen && diff.y < halfSize);
              // Top-right corner
              onShape = onShape || (diff.x > halfSize - armLen && diff.x <= halfSize
                                 && diff.y >= halfSize - thick && diff.y < halfSize);
              onShape = onShape || (diff.x > halfSize - thick && diff.x <= halfSize
                                 && diff.y >= halfSize - armLen && diff.y < halfSize);
              // Bottom-left corner
              onShape = onShape || (diff.x >= -halfSize && diff.x < -halfSize + armLen
                                 && diff.y >= -halfSize && diff.y < -halfSize + thick);
              onShape = onShape || (diff.x >= -halfSize && diff.x < -halfSize + thick
                                 && diff.y >= -halfSize && diff.y < -halfSize + armLen);
              // Bottom-right corner
              onShape = onShape || (diff.x > halfSize - armLen && diff.x <= halfSize
                                 && diff.y >= -halfSize && diff.y < -halfSize + thick);
              onShape = onShape || (diff.x > halfSize - thick && diff.x <= halfSize
                                 && diff.y >= -halfSize && diff.y < -halfSize + armLen);
            }

            if (onShape) {
              result = vec3(0.0, 1.0, 0.0);
            }
          }

          // ── Warp: hyperspace tunnel ──
          // Renders whenever hyperspace is active (ENTER/HYPER/EXIT)
          // OR when the fold portal is open (FOLD) — hyperspace is visible
          // THROUGH the portal so you visually "fly into" it.
          if (uHyperPhase > 0.0 || uFoldGlow > 0.0) {
            float hyperMask = uHyperPhase;

            // ── Fold portal mask: show hyperspace through the portal ──
            // Only renders once portalRadius > 0 (foldGlow > 0.25).
            // Edge width scales with radius so it starts from ~1 pixel
            // and grows outward — hard dithered mask (retro style).
            if (uFoldGlow > 0.25 && uExitReveal <= 0.0) {
              // Proportional edge: thin when portal is small, wider as it grows
              float edgeW = portalRadius * 0.15;
              float portalMask = smoothstep(portalRadius + edgeW, max(0.0, portalRadius - edgeW), portalDist);

              hyperMask = max(hyperMask, portalMask);
            }

            // Exit reveal: a hole opens at the tunnel vanishing point.
            // Starts as ~1 pixel, grows into a portal. The edge fizzes
            // with dithered energy particles — crackling boundary between
            // hyperspace and normal space.
            if (uExitReveal > 0.0) {
              vec2 toRift = vUv - uRiftCenter;
              float aspect = resolution.x / resolution.y;
              toRift.x *= aspect;
              float dist = length(toRift);

              // Hole radius: starts near zero, opens past screen diagonal (~1.02)
              // so the hole fully covers the screen including corners.
              float openRadius = uExitReveal * 1.2;

              // ── Fizzing dithered edge ──
              vec2 exitScreenPos = floor(vUv * resolution);
              // Animated noise — makes the edge sparkle/fizz
              float fizzNoise = fract(sin(dot(exitScreenPos, vec2(12.9898, 78.233)) + uHyperTime * 3.0) * 43758.5453);

              // Edge band: wider fizz zone as hole gets bigger
              float edgeWidth = max(0.02, openRadius * 0.2);

              // Inside hole = see through. Edge = fizzing dither. Outside = hyperspace.
              float fizzMask;
              if (dist < openRadius) {
                fizzMask = 0.0;
              } else if (dist < openRadius + edgeWidth) {
                float edgeFactor = (dist - openRadius) / edgeWidth;
                fizzMask = step(fizzNoise, edgeFactor);
              } else {
                fizzMask = 1.0;
              }

              hyperMask *= fizzMask;
            }

            // Only compute the expensive hyperspace tunnel for pixels that
            // actually show it. During FOLD/ENTER the portal is a small circle
            // — computing ray-cone math for every pixel wastes GPU time and
            // can cause visible hitches as the portal grows.
            if (hyperMask > 0.01) {
              vec3 hyper = hyperspace(vUv, uHyperTime);
              result = mix(result, hyper, hyperMask);
            }
          }

          // ── Film grain / static (retro CRT feel) ──
          // Animated per-frame noise over the entire image.
          // Like Star Fox 64's static effect — gives texture to flat
          // areas, unifies visual elements, authentic to the era.
          // Uses interleaved gradient noise (Jimenez 2014) for minimal banding.
          if (uGrainStrength > 0.0) {
            vec2 grainCoord = gl_FragCoord.xy + vec2(uTime * 120.7, uTime * 89.3);
            // Interleaved gradient noise — low banding, high frequency
            float grain = fract(52.9829189 * fract(dot(grainCoord, vec2(0.06711056, 0.00583715))));
            // Second hash pass for extra randomness
            grain = fract(grain * 3571.4953 + uTime * 17.31);
            result += (grain - 0.5) * uGrainStrength;
          }

          result = applyPalette(result, uColorPalette);
          gl_FragColor = vec4(result, 1.0);
        }
      `,

      depthTest: false,
      depthWrite: false,
    });

    this._compositeMesh = new THREE.Mesh(geometry, material);
    this._compositeMesh.frustumCulled = false;
    this._compositeScene = new THREE.Scene();
    this._compositeScene.add(this._compositeMesh);
    this._compositeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const renderWidth = Math.ceil(width / this.pixelScale);
    const renderHeight = Math.ceil(height / this.pixelScale);

    this.renderer.setSize(width, height, false);

    if (this.bgTarget) this.bgTarget.dispose();
    if (this.sceneTarget) this.sceneTarget.dispose();
    if (this.hudTarget) this.hudTarget.dispose();

    this.bgTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });

    this.sceneTarget = new THREE.WebGLRenderTarget(renderWidth, renderHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      depthBuffer: true,
      stencilBuffer: true,
    });
    // Explicit depth+stencil texture for proper stencil support
    this.sceneTarget.depthTexture = new THREE.DepthTexture(renderWidth, renderHeight);
    this.sceneTarget.depthTexture.format = THREE.DepthStencilFormat;
    this.sceneTarget.depthTexture.type = THREE.UnsignedInt248Type;

    this.hudTarget = new THREE.WebGLRenderTarget(this._hudSize, this._hudSize, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });

    const u = this._compositeMesh.material.uniforms;
    u.bgTexture.value = this.bgTarget.texture;
    u.sceneTexture.value = this.sceneTarget.texture;
    u.hudTexture.value = this.hudTarget.texture;
    u.resolution.value.set(width, height);

    // Adjust HUD position/size based on orientation
    const isPortrait = height > width;
    const isMobile = 'ontouchstart' in window;
    if (isPortrait && isMobile) {
      // Portrait mobile: smaller HUD in top-right to avoid mobile menu overlap
      this._hudFrac = 0.35;
      u.hudRect.value.set(0.62, 0.55, 0.35, 0.35);
    } else {
      // Landscape / desktop: normal bottom-right position
      this._hudFrac = 0.255;
      u.hudRect.value.set(0.73, 0.02, 0.255, 0.255);
    }

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
  }

  render() {
    const r = this.renderer;

    // Pass 1: Sky at full resolution (SkyRenderer scene or legacy starfieldScene)
    r.setRenderTarget(this.bgTarget);
    r.setClearColor(0x000000, 1);
    r.clear();
    // Render sky in two sub-passes so absorption meshes can darken the glow.
    // Pass 1A: glow + starfield (additive)
    // Pass 1B: features (includes absorption meshes with NormalBlending)
    const skyScene = this.getSkyScene();
    if (skyScene && this._skyRenderer) {
      // Render glow layer alone first
      const glowMesh = this._skyRenderer._glowLayer?.mesh;
      const starMesh = this._skyRenderer._starfieldLayer?.mesh;
      const featureGroup = this._skyRenderer._featureLayer?.mesh;

      // DEBUG: log once
      if (!this._absorbDebugDone) {
        this._absorbDebugDone = true;
        const absorbCount = featureGroup ? featureGroup.children.filter(c => c.material?.blending === THREE.NormalBlending).length : 0;
        const emitCount = featureGroup ? featureGroup.children.filter(c => c.material?.blending === THREE.AdditiveBlending).length : 0;
        console.log(`[SKY 2-PASS] glow=${!!glowMesh}, stars=${!!starMesh}, features=${!!featureGroup}, absorption meshes=${absorbCount}, emission meshes=${emitCount}`);
      }

      // Hide features, render glow + stars
      // Respect _hiddenForTitle flag — don't render glow if intentionally hidden
      const glowHidden = glowMesh?._hiddenForTitle;
      if (glowHidden && glowMesh) glowMesh.visible = false;
      if (featureGroup) featureGroup.visible = false;
      r.render(skyScene, this.camera);

      // Now show features (absorption + emission), render on top
      if (featureGroup) featureGroup.visible = true;
      if (glowMesh) glowMesh.visible = false;
      if (starMesh) starMesh.visible = false;
      r.autoClear = false;
      r.render(skyScene, this.camera);
      r.autoClear = true;
      if (glowMesh && !glowHidden) glowMesh.visible = true;
      if (starMesh) starMesh.visible = true;
    } else {
      r.render(skyScene, this.camera);
    }

    // Pass 2: Scene objects at low resolution
    r.setRenderTarget(this.sceneTarget);
    r.setClearColor(0x000000, 0);
    r.clear();
    // DEBUG: identify broken shaders
    if (!this._shaderDebugDone) {
      this._shaderDebugDone = true;
      this.scene.traverse((obj) => {
        if (obj.material && obj.material.type === 'ShaderMaterial') {
          const name = obj.material.name || obj.name || obj.constructor?.name || 'unknown';
          const hasVS = obj.material.vertexShader ? obj.material.vertexShader.length : 0;
          const hasFS = obj.material.fragmentShader ? obj.material.fragmentShader.length : 0;
          console.log(`[SHADER DEBUG] ${name}: VS=${hasVS} chars, FS=${hasFS} chars`);
        }
      });
    }
    r.render(this.scene, this.camera);

    // Pass 3: HUD at small resolution
    const u = this._compositeMesh.material.uniforms;
    if (this._hudScene && this._hudCamera) {
      r.setRenderTarget(this.hudTarget);
      r.setClearColor(0x000000, 0);
      r.clear();
      r.render(this._hudScene, this._hudCamera);
      u.hudEnabled.value = 1;
    } else {
      u.hudEnabled.value = 0;
    }

    // Pass 4: Composite all layers to screen
    r.setRenderTarget(null);
    r.clear();
    r.render(this._compositeScene, this._compositeCamera);
  }

  dispose() {
    if (this.bgTarget) this.bgTarget.dispose();
    if (this.sceneTarget) this.sceneTarget.dispose();
    if (this.hudTarget) this.hudTarget.dispose();
    this._compositeMesh.geometry.dispose();
    this._compositeMesh.material.dispose();
    this.renderer.dispose();
  }
}
