import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

/**
 * RetroRenderer — renders at a scaled-down resolution for chunky pixels.
 *
 * Dithering is NOT done here as a screen-wide filter. Instead, each object
 * (planets, stars, etc.) handles its own dithering in its fragment shader.
 * This makes the dithering look like it's part of the object's texture
 * rather than a flat overlay — much more authentic retro look.
 *
 * The EffectComposer is kept in place for future effects (warp tunnel, etc.)
 */
export class RetroRenderer {
  constructor(canvas, scene, camera) {
    this.canvas = canvas;
    this.camera = camera;
    this.pixelScale = 3; // Each render pixel = 3×3 screen pixels

    // ── WebGL Renderer ──
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
    });
    this.renderer.setPixelRatio(1);

    // ── Post-Processing Pipeline ──
    this.composer = new EffectComposer(this.renderer);

    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // Future passes (warp tunnel, etc.) will be added here

    this.resize();
  }

  resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const renderWidth = Math.ceil(width / this.pixelScale);
    const renderHeight = Math.ceil(height / this.pixelScale);

    // Dispose old render targets before creating new ones (prevents GPU memory leak)
    if (this.composer.writeBuffer) this.composer.writeBuffer.dispose();
    if (this.composer.readBuffer) this.composer.readBuffer.dispose();

    this.renderer.setSize(renderWidth, renderHeight, false);
    this.composer.setSize(renderWidth, renderHeight);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
  }

  render() {
    this.composer.render();
  }

  dispose() {
    this.renderer.dispose();
  }
}
