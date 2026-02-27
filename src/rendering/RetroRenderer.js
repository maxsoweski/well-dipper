import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { DitherShader } from './shaders/DitherPass.js';

/**
 * RetroRenderer — wraps the Three.js renderer with a post-processing pipeline
 * that gives everything the PS1/Saturn retro look.
 *
 * Pipeline order:
 * 1. RenderPass: renders the scene normally at 320×240
 * 2. DitherPass: applies 8×8 Bayer dithering + posterization to 15-bit color
 *
 * The low resolution (320×240) combined with CSS `image-rendering: pixelated`
 * handles the chunky pixel look. The dither pass handles the color reduction.
 */
export class RetroRenderer {
  constructor(canvas, scene, camera) {
    this.renderWidth = 640;
    this.renderHeight = 480;

    // ── WebGL Renderer ──
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,  // Sharp pixels, no smoothing
    });
    this.renderer.setSize(this.renderWidth, this.renderHeight, false);
    this.renderer.setPixelRatio(1);

    // ── Post-Processing Pipeline ──
    // EffectComposer chains multiple render passes together.
    // Each pass processes the image from the previous pass.
    this.composer = new EffectComposer(this.renderer);

    // Pass 1: Render the 3D scene normally
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // Pass 2: Dithering + posterization
    this.ditherPass = new ShaderPass(DitherShader);
    this.ditherPass.uniforms.resolution.value = new THREE.Vector2(
      this.renderWidth,
      this.renderHeight
    );
    this.composer.addPass(this.ditherPass);
  }

  /**
   * Render one frame through the full post-processing pipeline.
   */
  render() {
    this.composer.render();
  }

  /**
   * Clean up GPU resources.
   */
  dispose() {
    this.renderer.dispose();
  }
}
