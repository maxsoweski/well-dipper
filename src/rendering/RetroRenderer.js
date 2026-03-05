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
 * - Fold glow (bright lens-shaped core at screen center)
 * - Scene fade-out (sceneFade uniform)
 * - White flash entering the "slice" (whiteFlash uniform)
 * - Hyperspace geometric tunnel (Star Fox 64 / NMS style)
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
    this.starfieldScene = new THREE.Scene();

    // HUD (system map) — set via setHud()
    this._hudScene = null;
    this._hudCamera = null;
    this._hudSize = 192;   // HUD render target resolution (square)
    this._hudFrac = 0.20;  // HUD width as fraction of screen width

    // ── WebGL Renderer ──
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      logarithmicDepthBuffer: true,
    });
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
   * Set the HUD scene and camera (e.g. SystemMap).
   * @param {THREE.Scene} scene
   * @param {THREE.Camera} camera
   */
  setHud(scene, camera) {
    this._hudScene = scene;
    this._hudCamera = camera;
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
        hudRect: { value: new THREE.Vector4(0.78, 0.02, 0.20, 0.20) },
        hudEnabled: { value: 0 },
        resolution: { value: new THREE.Vector2(1, 1) },
        // Warp uniforms
        uSceneFade: { value: 0.0 },
        uWhiteFlash: { value: 0.0 },
        uHyperPhase: { value: 0.0 },
        uHyperTime: { value: 0.0 },
        uFoldGlow: { value: 0.0 },
        uExitReveal: { value: 0.0 },
        uRiftCenter: { value: new THREE.Vector2(0.5, 0.5) },  // UV space (0 to 1)
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
        uniform vec2 uRiftCenter;
        varying vec2 vUv;

        // ── Hyperspace tunnel (Star Fox 64 / No Man's Sky inspired) ──
        // Flying forward through a geometric tunnel surrounded by white light.
        // Sharp posterized edges for retro aesthetic.
        vec3 hyperspace(vec2 uv, float time) {
          vec2 centered = uv - 0.5;
          float aspect = resolution.x / resolution.y;
          centered.x *= aspect;

          float radius = length(centered);
          float angle = atan(centered.y, centered.x);

          // ── Tunnel depth (inverse radius = looking "into" the tunnel) ──
          float depth = 0.4 / (radius + 0.08);
          float scrollZ = depth + time * 2.5;

          // ── Background: white throughout ──
          vec3 bg = vec3(0.95, 0.93, 0.9);

          // ── Concentric rings rushing outward (forward motion) ──
          float ringPattern = fract(depth * 1.5 + time * 2.0);
          float rings = step(0.88, ringPattern);

          // ── Hexagonal geometry: 6-fold symmetry ──
          // Creates geometric "walls" of the tunnel
          float hexAngle = mod(angle + 0.5236, 1.0472) - 0.5236; // pi/6 offset, pi/3 period
          float hexEdge = abs(sin(hexAngle * 3.0));
          float hexDepth = fract(depth * 0.8 + time * 1.5);
          float hexPattern = step(0.92, hexEdge) * step(0.75, hexDepth);

          // ── Diamond grid overlay (cross-hatching) ──
          float grid1 = abs(sin(angle * 4.0 + scrollZ * 0.3));
          float grid2 = abs(sin(angle * 4.0 - scrollZ * 0.3 + 1.57));
          float diamonds = step(0.94, grid1) + step(0.94, grid2);
          diamonds = min(diamonds, 1.0) * smoothstep(0.6, 0.15, radius);

          // ── Radial speed lines ──
          float speedLine = abs(sin(angle * 24.0));
          speedLine = step(0.97, speedLine) * smoothstep(0.5, 0.1, radius);

          // ── Combine ──
          vec3 ringColor = vec3(0.85, 0.1, 0.1);      // red rings
          vec3 yellowColor = vec3(1.0, 0.85, 0.0);     // yellow shapes
          // Blink: shapes pulse on/off at ~3 Hz
          float blink = step(0.3, fract(time * 3.0));
          vec3 col = bg;
          col = mix(col, ringColor, rings * 0.8);
          col = mix(col, yellowColor, hexPattern * 0.7 * blink);
          col = mix(col, yellowColor, diamonds * 0.6 * blink);
          col += yellowColor * speedLine * 0.5 * blink;

          // ── Bright vanishing point (center) ──
          float centerBright = smoothstep(0.12, 0.0, radius);
          col = mix(col, vec3(1.0), centerBright);

          // ── Occasional flashes (particles rushing past) ──
          float flash = sin(angle * 30.0 + time * 6.0) * sin(depth * 3.0 + time * 8.0);
          flash = step(0.96, flash);
          col += yellowColor * flash * 0.6;

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

          // ── Fold glow: vertical white pillar at rift center that widens ──
          // Starts as a thin white slit, widens to cover the entire FOV.
          // Centered on uRiftCenter.x so it follows the rift direction.
          if (uFoldGlow > 0.0) {
            float xDist = abs(vUv.x - uRiftCenter.x);

            // Pillar half-width: grows cubically — stays thin much longer, then swells.
            // At uFoldGlow=1.0, halfWidth=0.55 which exceeds max xDist (0.5)
            float halfWidth = uFoldGlow * uFoldGlow * uFoldGlow * 0.55;

            // Solid opaque white core (hard edge)
            float core = step(xDist, halfWidth);

            // Soft outer halo for glow bleeding beyond the pillar edge
            float halo = smoothstep(halfWidth + 0.15, halfWidth, xDist) * 0.3 * uFoldGlow;

            float glow = max(core, halo);
            result = mix(result, vec3(1.0), glow);
          }

          // ── HUD overlay (hidden during warp) ──
          if (hudEnabled > 0.5 && uSceneFade < 0.5 && uFoldGlow < 0.3) {
            float aspect = resolution.x / resolution.y;
            float hudW = hudRect.z;
            float hudH = hudRect.w * aspect;
            float hudX = hudRect.x;
            float hudY = hudRect.y;

            if (vUv.x > hudX && vUv.x < hudX + hudW &&
                vUv.y > hudY && vUv.y < hudY + hudH) {
              vec2 hudUV = (vUv - vec2(hudX, hudY)) / vec2(hudW, hudH);
              vec4 hud = texture2D(hudTexture, hudUV);

              result = mix(result, vec3(0.0), 0.5);
              result = mix(result, hud.rgb, hud.a);
            }
          }

          // ── Warp: hyperspace tunnel ──
          if (uHyperPhase > 0.0) {
            vec3 hyper = hyperspace(vUv, uHyperTime);
            float hyperMask = uHyperPhase;

            // Exit reveal: hyperspace tears open from center, revealing stars.
            // A dark circular opening grows from the rift center — no white edge,
            // just a clean crack into the new starfield.
            if (uExitReveal > 0.0) {
              vec2 toRift = vUv - uRiftCenter;
              float aspect = resolution.x / resolution.y;
              toRift.x *= aspect;
              float dist = length(toRift);

              // Opening radius — JS sends ease-out curve (fast start),
              // so use it linearly here for immediate visibility
              float openRadius = uExitReveal * 0.9;

              // Inside opening = no hyperspace (starfield shows through)
              hyperMask *= smoothstep(openRadius * 0.85, openRadius, dist);
            }

            result = mix(result, hyper, hyperMask);
          }

          // ── Warp: white flash (entering the slice) ──
          if (uWhiteFlash > 0.0) {
            result = mix(result, vec3(1.0), uWhiteFlash);
          }

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
    });

    this.hudTarget = new THREE.WebGLRenderTarget(this._hudSize, this._hudSize, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });

    const u = this._compositeMesh.material.uniforms;
    u.bgTexture.value = this.bgTarget.texture;
    u.sceneTexture.value = this.sceneTarget.texture;
    u.hudTexture.value = this.hudTarget.texture;
    u.resolution.value.set(width, height);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
  }

  render() {
    const r = this.renderer;

    // Pass 1: Starfield at full resolution
    r.setRenderTarget(this.bgTarget);
    r.setClearColor(0x000000, 1);
    r.clear();
    r.render(this.starfieldScene, this.camera);

    // Pass 2: Scene objects at low resolution
    r.setRenderTarget(this.sceneTarget);
    r.setClearColor(0x000000, 0);
    r.clear();
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
