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
 * - Scene fade-out (sceneFade uniform)
 * - White flash entering the "slice" (whiteFlash uniform)
 * - Hyperspace tunnel streaks (hyperPhase + hyperTime uniforms)
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
   */
  setWarpUniforms(sceneFade, whiteFlash, hyperPhase, hyperTime) {
    const u = this._compositeMesh.material.uniforms;
    u.uSceneFade.value = sceneFade;
    u.uWhiteFlash.value = whiteFlash;
    u.uHyperPhase.value = hyperPhase;
    u.uHyperTime.value = hyperTime;
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
        hudRect: { value: new THREE.Vector4(0.78, 0.02, 0.20, 0.20) }, // x, y, w, h in UV
        hudEnabled: { value: 0 },
        resolution: { value: new THREE.Vector2(1, 1) },
        // Warp uniforms
        uSceneFade: { value: 0.0 },   // 0 = normal, 1 = scene hidden
        uWhiteFlash: { value: 0.0 },  // 0 = normal, 1 = full white
        uHyperPhase: { value: 0.0 },  // 0 = normal, 1 = hyperspace
        uHyperTime: { value: 0.0 },   // elapsed seconds (drives animation)
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
        uniform vec4 hudRect;     // (x, y, w, h) in UV space
        uniform float hudEnabled;
        uniform vec2 resolution;
        // Warp uniforms
        uniform float uSceneFade;
        uniform float uWhiteFlash;
        uniform float uHyperPhase;
        uniform float uHyperTime;
        varying vec2 vUv;

        // ── Hyperspace tunnel effect ──
        // Procedural speed lines flowing from edges toward center.
        // Retro aesthetic: sharp lines, posterized colors, no smooth gradients.
        vec3 hyperspace(vec2 uv, float time) {
          // Center UV so (0,0) is screen center
          vec2 centered = uv - 0.5;
          float aspect = resolution.x / resolution.y;
          centered.x *= aspect;

          // Polar coordinates from center
          float angle = atan(centered.y, centered.x);
          float radius = length(centered);

          // Tunnel effect: radial lines that "flow" inward
          // Multiple frequency layers for depth
          float line1 = sin(angle * 12.0 + time * 3.0 + radius * 20.0);
          float line2 = sin(angle * 8.0 - time * 2.0 + radius * 15.0);
          float line3 = sin(angle * 20.0 + time * 5.0 + radius * 30.0);

          // Sharpen lines (posterize for retro look)
          line1 = step(0.7, line1);
          line2 = step(0.75, line2);
          line3 = step(0.85, line3);

          // Combine: brighter toward center (tunnel depth illusion)
          float centerGlow = smoothstep(0.8, 0.0, radius);
          float streaks = max(max(line1 * 0.5, line2 * 0.4), line3 * 0.3);

          // Color palette: deep blue/purple base with white-blue streaks
          vec3 base = vec3(0.02, 0.01, 0.06);  // near-black purple
          vec3 streak = vec3(0.3, 0.5, 1.0);    // blue-white
          vec3 glow = vec3(0.1, 0.15, 0.4);     // subtle center glow

          vec3 col = base;
          col += streak * streaks;
          col += glow * centerGlow * 0.5;

          // Occasional bright flashes (sparse white dots traveling inward)
          float flash = sin(angle * 30.0 + time * 8.0) * sin(radius * 40.0 - time * 12.0);
          flash = step(0.95, flash) * 0.8;
          col += vec3(flash);

          return col;
        }

        void main() {
          vec4 bg = texture2D(bgTexture, vUv);
          vec4 scene = texture2D(sceneTexture, vUv);

          // Use alpha to decide what's "scene" vs "empty space".
          // Objects render with alpha=1 (even dark shadows), empty space has alpha=0.
          vec3 result = mix(bg.rgb, scene.rgb, scene.a);

          // ── Warp: scene fade ──
          // Fade scene objects toward black during warp fold
          if (uSceneFade > 0.0) {
            float fadeScene = scene.a * (1.0 - uSceneFade);
            result = mix(bg.rgb, scene.rgb, fadeScene);
          }

          // ── HUD overlay (hidden during warp) ──
          if (hudEnabled > 0.5 && uSceneFade < 0.5) {
            // Compute square HUD region in UV space, accounting for aspect ratio
            float aspect = resolution.x / resolution.y;
            float hudW = hudRect.z;                  // width in UV-x
            float hudH = hudRect.w * aspect;         // height in UV-y (corrected to be square)
            float hudX = hudRect.x;                  // left edge
            float hudY = hudRect.y;                  // bottom edge

            if (vUv.x > hudX && vUv.x < hudX + hudW &&
                vUv.y > hudY && vUv.y < hudY + hudH) {
              // Map screen UV to HUD texture UV
              vec2 hudUV = (vUv - vec2(hudX, hudY)) / vec2(hudW, hudH);
              vec4 hud = texture2D(hudTexture, hudUV);

              // Semi-transparent dark background for readability
              result = mix(result, vec3(0.0), 0.5);
              // Blend HUD content on top
              result = mix(result, hud.rgb, hud.a);
            }
          }

          // ── Warp: hyperspace tunnel ──
          if (uHyperPhase > 0.0) {
            vec3 hyper = hyperspace(vUv, uHyperTime);
            result = mix(result, hyper, uHyperPhase);
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

    // Renderer at full resolution (composite outputs to screen at this size)
    this.renderer.setSize(width, height, false);

    // Dispose old render targets to prevent GPU memory leak
    if (this.bgTarget) this.bgTarget.dispose();
    if (this.sceneTarget) this.sceneTarget.dispose();
    if (this.hudTarget) this.hudTarget.dispose();

    // Starfield target: full resolution for tiny crisp star points
    this.bgTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });

    // Scene target: low resolution for chunky retro pixels.
    // NearestFilter on magFilter means each low-res texel maps to a
    // sharp block of screen pixels when sampled in the composite pass.
    this.sceneTarget = new THREE.WebGLRenderTarget(renderWidth, renderHeight, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });

    // HUD target: small square, NearestFilter for retro pixel look
    this.hudTarget = new THREE.WebGLRenderTarget(this._hudSize, this._hudSize, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });

    // Update composite texture references
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

    // Pass 1: Starfield at full resolution (tiny crisp star points)
    r.setRenderTarget(this.bgTarget);
    r.setClearColor(0x000000, 1);  // opaque black background for stars
    r.clear();
    r.render(this.starfieldScene, this.camera);

    // Pass 2: Scene objects at low resolution (chunky retro pixels)
    // Clear with transparent black (alpha=0) so empty pixels don't cover the starfield.
    // Objects write alpha=1, empty space stays alpha=0 — the composite shader
    // uses this alpha to decide starfield vs scene (not brightness, which fails on shadows).
    r.setRenderTarget(this.sceneTarget);
    r.setClearColor(0x000000, 0);  // transparent black — key for alpha compositing
    r.clear();
    r.render(this.scene, this.camera);

    // Pass 3: HUD (system map) at small resolution
    const u = this._compositeMesh.material.uniforms;
    if (this._hudScene && this._hudCamera) {
      r.setRenderTarget(this.hudTarget);
      r.setClearColor(0x000000, 0);  // transparent black
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
