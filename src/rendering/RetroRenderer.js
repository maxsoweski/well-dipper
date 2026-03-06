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

    // HUD rect in UV space (same values as the shader uniform)
    const hudX = 0.78;
    const hudY = 0.02;
    const hudW = 0.20;
    const hudH = 0.20 * aspect;

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
        // Warp target selection brackets
        uTargetUV: { value: new THREE.Vector2(0.5, 0.5) },    // UV of selected star
        uTargetBlink: { value: 0.0 },                          // 0 = off, 1 = on
        uTargetSize: { value: 0.0 },                           // bracket size in pixels
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
        // Warp target brackets
        uniform vec2 uTargetUV;
        uniform float uTargetBlink;
        uniform float uTargetSize;
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
          float tunnelR = 4.0;        // Radius at camera (wide opening)
          float taper = 0.15;         // Cone narrowing rate (0 = cylinder)
          float speed = time * 12.0;  // Forward scroll speed
          float ringGap = 3.5;       // Spacing between ring planes

          // ── Ray–cone intersection ──
          // Cone along Z, radius tunnelR at z=0, narrowing to a point at z=R/taper≈27.
          // Solving gives: t = R / (rdXY + taper * rd.z)
          float rdXY = length(rd.xy);
          float denom = rdXY + taper * rd.z;
          if (denom < 0.001) {
            return vec3(1.0);
          }
          float tWall = tunnelR / denom;
          vec3 hitPos = rd * tWall;
          float wallZ = hitPos.z;  // How far down tunnel the hit is

          // Normalized depth: 0 = near camera, 1 = at the cone apex
          float maxZ = tunnelR / taper;  // cone apex distance (~27)
          float depthNorm = clamp(wallZ / maxZ, 0.0, 1.0);

          // ── Anaglyph 3D ring bands (red/cyan offset like old 3D glasses) ──
          float zWorld = wallZ + speed;
          float offset = 0.45;  // how far apart red and blue rings are

          // Red channel ring band (shifted forward)
          float redPhase = fract((zWorld + offset) / ringGap);
          float redBand = smoothstep(0.0, 0.06, redPhase)
                        * (1.0 - smoothstep(0.12, 0.18, redPhase));

          // Blue/cyan channel ring band (shifted backward)
          float bluPhase = fract((zWorld - offset) / ringGap);
          float bluBand = smoothstep(0.0, 0.06, bluPhase)
                        * (1.0 - smoothstep(0.12, 0.18, bluPhase));

          // Depth fade: rings fade toward the cone apex
          float depthFade = 1.0 - depthNorm * depthNorm;
          redBand *= depthFade;
          bluBand *= depthFade;

          // ── Wall shading: bright near edges, dark toward cone apex ──
          vec3 nearColor = vec3(0.95, 0.93, 0.9);   // bright cream near camera
          vec3 farColor  = vec3(0.35, 0.33, 0.38);   // dark grey-purple at apex
          float depthCurve = depthNorm * depthNorm;
          vec3 wallColor = mix(nearColor, farColor, depthCurve);
          wallColor *= 1.0 - rdXY * 0.15;

          // ── Compose: apply red and blue as separate channels ──
          // Where they overlap → bright white/pink. Where they don't → pure color fringe.
          vec3 col = wallColor;
          col.r = mix(col.r, 0.9, redBand * 0.55);
          col.gb = mix(col.gb, vec2(0.85, 0.9), bluBand * 0.55);

          // ── Vanishing point glow ──
          float centerDist = length(centered);
          float centerGlow = smoothstep(0.15, 0.0, centerDist);
          col = mix(col, vec3(1.0), centerGlow * 0.6);

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

              result = mix(result, vec3(0.0), 0.5);
              result = mix(result, hud.rgb, hud.a);

              // Subtle border ring at the edge (1px, dim green)
              float borderThick = 1.0 / resolution.x;
              if (dist > hudRadius - borderThick) {
                result = mix(result, vec3(0.08, 0.25, 0.08), 0.45);
              }
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
            vec3 hyper = hyperspace(vUv, uHyperTime);
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
