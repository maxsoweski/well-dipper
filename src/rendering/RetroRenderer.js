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

        // ── Hyperspace tunnel (3D raymarched cylinder) ──
        // Real 3D ray-cylinder intersection so the tunnel has true
        // perspective depth. Future-proofed for freelook / rail-flying.
        vec3 hyperspace(vec2 uv, float time) {
          // ── Ray setup: camera at origin looking down +Z ──
          vec2 centered = uv - 0.5;
          float aspect = resolution.x / resolution.y;
          centered.x *= aspect;

          // Perspective ray (matches ~70° FOV)
          vec3 rd = normalize(vec3(centered * 1.4, 1.0));

          // Tunnel parameters
          float tunnelR = 4.0;        // Radius — big enough to feel enormous
          float speed = time * 12.0;  // Forward scroll speed
          float ringGap = 3.5;       // Spacing between ring planes

          vec3 bg = vec3(0.95, 0.93, 0.9);

          // ── Ray–cylinder intersection ──
          // Infinite cylinder along Z, radius tunnelR, camera at center
          float rdXY = length(rd.xy);
          if (rdXY < 0.001) {
            // Looking straight down the tunnel — vanishing point
            return vec3(1.0);
          }
          float tWall = tunnelR / rdXY;
          vec3 hitPos = rd * tWall;
          float wallZ = hitPos.z;  // How far down tunnel the hit is

          // ── Ring bands repeating along Z ──
          float zWorld = wallZ + speed;
          float cellPhase = fract(zWorld / ringGap);

          // Narrow bright band within each repeating cell
          float ringBand = smoothstep(0.0, 0.06, cellPhase)
                         * (1.0 - smoothstep(0.12, 0.18, cellPhase));

          // ── Depth perspective: near rings bold, distant rings fade ──
          float depthFade = smoothstep(60.0, 4.0, wallZ);
          float nearBoost = smoothstep(6.0, 3.0, wallZ);
          float ringIntensity = ringBand * (depthFade * 0.6 + nearBoost * 0.4);

          // ── Dithering (hash noise, no grid artifacts) ──
          vec2 screenPos = floor(uv * resolution);
          float noise = fract(sin(dot(screenPos, vec2(12.9898, 78.233))) * 43758.5453);
          float ditheredRing = step(noise, ringIntensity * 0.8);

          // ── Color: red↔blue blink at 0.75 Hz ──
          vec3 redColor = vec3(0.8, 0.15, 0.15);
          vec3 blueColor = vec3(0.15, 0.25, 0.85);
          float ringBlink = step(0.5, fract(time * 0.75));
          vec3 ringColor = mix(redColor, blueColor, ringBlink);

          // ── Wall depth shading: subtle darkening toward edges ──
          float wallShade = 1.0 - rdXY * 0.3;

          // ── Compose ──
          vec3 col = bg * wallShade;
          col = mix(col, ringColor, ditheredRing * 0.35);

          // ── Vanishing point glow ──
          float centerDist = length(centered);
          float centerGlow = smoothstep(0.1, 0.0, centerDist);
          col = mix(col, vec3(1.0), centerGlow);

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
            portalRadius = uFoldGlow * 0.45;

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
          // Renders whenever hyperspace is active (ENTER/HYPER/EXIT)
          // OR when the fold portal is open (FOLD) — hyperspace is visible
          // THROUGH the portal so you visually "fly into" it.
          if (uHyperPhase > 0.0 || uFoldGlow > 0.0) {
            vec3 hyper = hyperspace(vUv, uHyperTime);
            float hyperMask = uHyperPhase;

            // ── Fold portal mask: show hyperspace through the portal ──
            // During FOLD, portalRadius/portalDist are set by the fold
            // portal block above. Hyperspace peeks through with a
            // dithered edge that matches the retro aesthetic.
            if (uFoldGlow > 0.0 && uExitReveal <= 0.0) {
              vec2 pScreenPos = floor(vUv * resolution);
              float pNoise = fract(sin(dot(pScreenPos, vec2(12.9898, 78.233))) * 43758.5453);

              // Gradient: fully visible at center, dithered fade at edge
              float pGrad = smoothstep(portalRadius + 0.03, max(0.0, portalRadius - 0.02), portalDist);
              float portalMask = step(pNoise, pGrad) * uFoldGlow;

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

              // Hole radius: starts near zero, opens up
              float openRadius = uExitReveal * 0.85;

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
