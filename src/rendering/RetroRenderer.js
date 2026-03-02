import * as THREE from 'three';

/**
 * RetroRenderer — dual-resolution multi-pass compositor.
 *
 * The starfield renders at FULL resolution (tiny crisp star points).
 * Scene objects (planets, stars, moons, etc.) render at LOW resolution
 * (pixelScale 3 = each render pixel covers 3×3 screen pixels).
 *
 * A composite pass blends them: black scene pixels (empty space) reveal
 * the high-res starfield behind them, while colored scene pixels take
 * priority. This creates natural depth separation — distant pinpoint
 * stars vs chunky retro foreground objects.
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

    // ── WebGL Renderer ──
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.autoClear = false; // We manage clearing per-pass

    // Render targets (created in resize())
    this.bgTarget = null;    // Full-res starfield
    this.sceneTarget = null; // Low-res scene objects

    // ── Composite pass (blends starfield + scene) ──
    this._setupComposite();

    this.resize();
  }

  /**
   * Build the fullscreen composite quad + shader.
   * Samples both render targets and uses brightness to decide
   * which layer to show at each pixel.
   */
  _setupComposite() {
    const geometry = new THREE.PlaneGeometry(2, 2);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        bgTexture: { value: null },
        sceneTexture: { value: null },
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
        varying vec2 vUv;

        void main() {
          vec4 bg = texture2D(bgTexture, vUv);
          vec4 scene = texture2D(sceneTexture, vUv);

          // Use alpha to decide what's "scene" vs "empty space".
          // Objects render with alpha=1 (even dark shadows), empty space has alpha=0.
          // This prevents the starfield from bleeding through dark planet shadows
          // (the old brightness-threshold approach treated dark pixels as empty).
          gl_FragColor = vec4(mix(bg.rgb, scene.rgb, scene.a), 1.0);
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

    // Update composite texture references
    this._compositeMesh.material.uniforms.bgTexture.value = this.bgTarget.texture;
    this._compositeMesh.material.uniforms.sceneTexture.value = this.sceneTarget.texture;

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

    // Pass 3: Composite both layers to screen
    r.setRenderTarget(null);
    r.clear();
    r.render(this._compositeScene, this._compositeCamera);
  }

  dispose() {
    if (this.bgTarget) this.bgTarget.dispose();
    if (this.sceneTarget) this.sceneTarget.dispose();
    this._compositeMesh.geometry.dispose();
    this._compositeMesh.material.dispose();
    this.renderer.dispose();
  }
}
